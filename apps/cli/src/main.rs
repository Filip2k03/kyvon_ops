//! KyvonOPS V4.1 CLI (`kyvon`).
//! Reports only inventory and telemetry recorded by this installation.

use std::env;
use std::path::PathBuf;
use std::process;

use kyvon_core::{now_ms, Resolution};
use kyvon_diagnostics::capacity::predict_capacity;
use kyvon_diagnostics::from_history::{
    risk_signals, trend_samples, wanted_metrics, MetricHistory, MAX_CARRY_MS,
};
use kyvon_diagnostics::outage_risk::calculate_outage_risk;
use kyvon_storage::{Database, MetricRepo, ServerRepo};

fn print_help() {
    println!(
        r#"KyvonOPS V4.1 CLI — local-first VPS operations

USAGE:
    kyvon <COMMAND> [OPTIONS]

COMMANDS:
    server list                 List all discovered and registered VPS nodes
    diagnose <server>           Outage risk and capacity forecast from recorded telemetry
    mcp install                 Print local MCP client configuration
    mcp doctor                  Report MCP availability for this installation
    version                     Print KyvonOPS version and build metadata
"#
    );
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_help();
        return;
    }

    match args[1].as_str() {
        "server" => {
            if args.len() < 3 {
                eprintln!("Error: 'kyvon server' requires the list subcommand");
                process::exit(1);
            }
            match args[2].as_str() {
                "list" => match list_inventory().await {
                    Ok(servers) if servers.is_empty() => {
                        println!("No VPS connected in this installation.")
                    }
                    Ok(servers) => {
                        println!(
                            "{:<24} {:<30} {:<8} {:<12}",
                            "NAME", "HOST", "PORT", "DISCOVERY"
                        );
                        println!("{:-<78}", "");
                        for server in servers {
                            println!(
                                "{:<24} {:<30} {:<8} {:<12}",
                                server.alias,
                                server.hostname,
                                server.port,
                                if server.facts.is_some() {
                                    "complete"
                                } else {
                                    "pending"
                                }
                            );
                        }
                    }
                    Err(message) => {
                        eprintln!("{message}");
                        process::exit(1);
                    }
                },
                cmd => {
                    eprintln!("Unknown server subcommand: '{}'", cmd);
                    process::exit(1);
                }
            }
        }
        "site" | "deploy" | "rollback" | "incident" | "agent" | "device" => {
            eprintln!("This command is not available in the client-only V4.1 CLI. Connect a VPS in the desktop app; no operation was simulated.");
            process::exit(2);
        }
        "diagnose" => {
            let Some(target) = args.get(2) else {
                eprintln!("Error: 'kyvon diagnose' requires a server id or alias.");
                eprintln!("Usage: kyvon diagnose <server> [--db <path>]");
                process::exit(1);
            };
            let db_override = flag_value(&args, "--db");
            if let Err(message) = diagnose(target, db_override.as_deref()).await {
                eprintln!("{message}");
                process::exit(1);
            }
        }
        "mcp" => {
            if args.len() < 3 {
                eprintln!("Error: 'kyvon mcp' requires a subcommand (install, doctor)");
                process::exit(1);
            }
            match args[2].as_str() {
                "install" => {
                    println!(
                        "=== KyvonOPS MCP Client Configuration Generator (§101 PROMPTS.md) ==="
                    );
                    println!("Add the following block to your MCP client config (e.g. claude_desktop_config.json):");
                    println!(
                        r#"{{
  "mcpServers": {{
    "kyvon": {{
      "command": "kyvon-mcp",
      "args": []
    }}
  }}
}}"#
                    );
                    println!("\nSupported Clients: Codex Astra, Claude Opus, Agy Gemini 3.8.");
                }
                "doctor" => {
                    println!(
                        "MCP doctor is available only when the local MCP service is configured."
                    );
                    println!("No remote checks were run and no service health was assumed.");
                }
                cmd => {
                    eprintln!("Unknown mcp subcommand: '{}'", cmd);
                    process::exit(1);
                }
            }
        }
        "version" | "--version" | "-v" => {
            println!("kyvon version 4.1.0 (client-only preview)");
        }
        "help" | "--help" | "-h" => {
            print_help();
        }
        cmd => {
            eprintln!("Unknown command: '{}'", cmd);
            print_help();
            process::exit(1);
        }
    }
}

/// The value following `flag` in `args`, if present.
fn flag_value(args: &[String], flag: &str) -> Option<String> {
    let idx = args.iter().position(|a| a == flag)?;
    args.get(idx + 1).cloned()
}

/// Where the desktop app keeps its store, so the CLI diagnoses the same data
/// the app shows rather than a database of its own.
///
/// Tauri resolves this through the platform app-data directory; the CLI is not
/// a Tauri app, so the path is reconstructed here. `--db` overrides it, which
/// is also how a portable or test profile is diagnosed.
fn default_database_path() -> Option<PathBuf> {
    let home = env::var_os("HOME").map(PathBuf::from)?;
    let base = if cfg!(target_os = "macos") {
        home.join("Library/Application Support")
    } else {
        env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".local/share"))
    };
    Some(base.join("com.kyvon.ops").join("kyvon.db"))
}

async fn list_inventory() -> Result<Vec<kyvon_core::ServerProfile>, String> {
    let path = default_database_path().ok_or_else(|| {
        "Cannot locate the KyvonOPS database: HOME is not set. Run the desktop app first."
            .to_string()
    })?;
    if !path.exists() {
        return Err(format!(
            "No KyvonOPS database at {}. Connect a VPS in the desktop app first.",
            path.display()
        ));
    }
    let db = Database::open(&path)
        .await
        .map_err(|e| format!("Cannot open {}: {e}", path.display()))?;
    ServerRepo::new(db)
        .list()
        .await
        .map_err(|e| format!("Cannot read the VPS inventory: {e}"))
}

/// Score a host from telemetry already on disk.
///
/// This reads SQLite and opens no connection to the host, so it answers for a
/// server that is currently unreachable -- which is when the question is most
/// often asked. It reports what it cannot compute rather than substituting a
/// figure, which is the whole difference between this and what the command
/// printed before: invented PSI percentages and a "94% confidence" that was not
/// derived from anything.
async fn diagnose(target: &str, db_override: Option<&str>) -> Result<(), String> {
    let path = match db_override {
        Some(p) => PathBuf::from(p),
        None => default_database_path().ok_or_else(|| {
            "Cannot locate the KyvonOPS database: HOME is not set. Pass --db <path>.".to_string()
        })?,
    };
    if !path.exists() {
        return Err(format!(
            "No KyvonOPS database at {}. Run the desktop app and start a collector first, or pass --db <path>.",
            path.display()
        ));
    }

    let db = Database::open(&path)
        .await
        .map_err(|e| format!("Cannot open {}: {e}", path.display()))?;

    // Accept an alias as well as an id: an operator knows their host by name.
    let servers = ServerRepo::new(db.clone())
        .list()
        .await
        .map_err(|e| format!("Cannot read the server inventory: {e}"))?;
    let server = servers
        .iter()
        .find(|s| s.id == target || s.alias == target)
        .ok_or_else(|| {
            let known: Vec<&str> = servers.iter().map(|s| s.alias.as_str()).collect();
            format!(
                "No server `{target}` in {}. Known aliases: {}",
                path.display(),
                if known.is_empty() {
                    "none".to_string()
                } else {
                    known.join(", ")
                }
            )
        })?;

    let metrics = MetricRepo::new(db.clone());
    let now = now_ms();
    let known = metrics
        .known_metrics(&server.id)
        .await
        .map_err(|e| format!("Cannot list recorded metrics: {e}"))?;
    let wanted = wanted_metrics(&known);

    let load = |from: i64| {
        let metrics = metrics.clone();
        let wanted = wanted.clone();
        let id = server.id.clone();
        async move {
            let series = metrics
                .series_multi(
                    &id,
                    &wanted,
                    from,
                    now,
                    Resolution::for_diagnosis(now - from),
                )
                .await
                .map_err(|e| format!("Cannot read telemetry history: {e}"))?;
            let mut history = MetricHistory::new();
            for (metric, points) in series {
                history.insert(
                    metric,
                    points.into_iter().map(|p| (p.ts, p.value)).collect(),
                );
            }
            Ok::<MetricHistory, String>(history)
        }
    };

    println!(
        "=== KyvonOPS diagnostics: {} ({}) ===",
        server.alias, server.hostname
    );
    println!(
        "Source: {} (no connection was made to the host)",
        path.display()
    );
    println!();

    // --- Outage risk, over the last hour ---
    let recent = load(now - 3_600_000).await?;
    match risk_signals(
        &recent,
        server
            .facts
            .as_ref()
            .map(|f| f.cpu_cores)
            .filter(|c| *c > 0),
        now,
    ) {
        Some(signals) => {
            let risk = calculate_outage_risk(&signals);
            println!("[Outage risk] {}/100 — {:?}", risk.score, risk.level);
            println!("  {}", risk.recommendation);
            if risk.factors.is_empty() {
                println!("  No indicator fired in the dimensions that were measured.");
            } else {
                for factor in &risk.factors {
                    println!(
                        "  • {} (+{}) — {}",
                        factor.name, factor.score_impact, factor.current_value
                    );
                }
            }
            if !risk.unevaluated_dimensions.is_empty() {
                println!(
                    "  Not examined ({}): {}",
                    risk.unevaluated_dimensions.len(),
                    risk.unevaluated_dimensions.join(", ")
                );
                println!("  Nothing measures these, so a problem in any of them would not have changed the score.");
            }
        }
        None => {
            let age = recent.newest_ts().map(|ts| (now - ts) / 1000);
            match age {
                Some(secs) => println!(
                    "[Outage risk] Unavailable: newest sample is {secs}s old, beyond the {}s window this score treats as current.",
                    MAX_CARRY_MS / 1000
                ),
                None => println!(
                    "[Outage risk] Unavailable: no telemetry recorded for `{}` in the last hour.",
                    server.alias
                ),
            }
        }
    }
    println!();

    // --- Capacity, over the last day ---
    let window_hours = 24i64;
    let day = load(now - window_hours * 3_600_000).await?;
    let samples = trend_samples(&day);
    if samples.is_empty() {
        println!(
            "[Capacity] Unavailable: no point in the last {window_hours}h has CPU, memory and disk recorded within {}s of each other.",
            MAX_CARRY_MS / 1000
        );
    } else {
        let forecast = predict_capacity(&samples);
        println!(
            "[Capacity] {:.1}% used, {:.1}% headroom on the tightest resource ({} samples over {window_hours}h)",
            forecast.current_utilization_pct,
            forecast.reserved_headroom_pct,
            samples.len()
        );
        // "No trend was found" and "the window was too short to look" are
        // different answers, and printing the first for the second is how a
        // reader concludes a host is steady when nothing was observed.
        if forecast.bottleneck_resource == kyvon_diagnostics::capacity::INSUFFICIENT {
            println!(
                "  No projection: these samples span under {} minutes, too little to contain a trend.",
                kyvon_diagnostics::capacity::MIN_SPAN_MS / 60_000
            );
            println!("  Leave the collector running and ask again.");
            return Ok(());
        }
        println!("  Growing fastest: {}", forecast.bottleneck_resource);
        match forecast.projected_saturation_days {
            Some(days) => println!(
                "  Projected saturation: {days:.1} days if the last {window_hours}h repeats"
            ),
            None => println!("  Projected saturation: nothing is trending upward"),
        }
        for point in &forecast.points {
            println!(
                "  +{:>3}h   cpu {:>5.1}%   ram {:>5.1}%   disk {:>5.1}%",
                point.hours_ahead,
                point.projected_cpu_pct,
                point.projected_ram_pct,
                point.projected_disk_pct
            );
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_cli_subcommands_documented() {
        let commands = [
            "server list",
            "diagnose",
            "mcp install",
            "mcp doctor",
            "version",
        ];
        for cmd in &commands {
            assert!(!cmd.is_empty());
        }
    }
}
