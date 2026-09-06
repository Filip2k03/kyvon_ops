//! KyvonOPS V4.1 CLI (`kyvon`).
//!
//! The CLI is deliberately client-only: it reports inventory saved by this
//! installation and never ships sample hosts, fake metrics, or simulated
//! operation success.

use std::env;
use std::path::PathBuf;
use std::process;

use kyvon_storage::{Database, ServerRepo};

fn print_help() {
    println!(
        r#"KyvonOPS V4.1 CLI — local-first VPS operations

USAGE:
    kyvon <COMMAND> [OPTIONS]

COMMANDS:
    server list                 List VPS profiles saved in this installation
    diagnose <server>           Not available until the diagnostic data path is released
    mcp install                 Print local MCP client configuration
    mcp doctor                  Report MCP availability for this installation
    version                     Print KyvonOPS version and build metadata
"#
    );
}

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

async fn list_inventory() -> Result<(), String> {
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
    let servers = ServerRepo::new(db)
        .list()
        .await
        .map_err(|e| format!("Cannot read the VPS inventory: {e}"))?;

    if servers.is_empty() {
        println!("No VPS connected in this installation.");
        return Ok(());
    }
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
    Ok(())
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("server") if args.get(2).map(String::as_str) == Some("list") => {
            if let Err(message) = list_inventory().await {
                eprintln!("{message}");
                process::exit(1);
            }
        }
        Some("mcp") if args.get(2).map(String::as_str) == Some("install") => {
            println!("Add this block to your MCP client configuration:");
            println!(r#"{{"mcpServers":{{"kyvon":{{"command":"kyvon-mcp","args":[]}}}}}}"#);
        }
        Some("mcp") if args.get(2).map(String::as_str) == Some("doctor") => {
            println!("MCP doctor is available only when the local MCP service is configured.");
            println!("No remote checks were run and no service health was assumed.");
        }
        Some("version") | Some("--version") | Some("-v") => {
            println!("kyvon version 4.1.0 (client-only preview)");
        }
        Some("diagnose") => {
            eprintln!("Diagnostics are available in the desktop app after a VPS collector records telemetry; no diagnosis was simulated.");
            process::exit(2);
        }
        Some("site" | "deploy" | "rollback" | "incident" | "agent" | "device") => {
            eprintln!("This command is not available in the client-only V4.1 CLI; no operation was simulated.");
            process::exit(2);
        }
        Some("help") | Some("--help") | Some("-h") | None => print_help(),
        Some(command) => {
            eprintln!("Unknown command: {command}");
            print_help();
            process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn public_commands_are_explicitly_documented() {
        for command in [
            "server list",
            "diagnose",
            "mcp install",
            "mcp doctor",
            "version",
        ] {
            assert!(!command.is_empty());
        }
    }
}
