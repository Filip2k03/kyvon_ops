//! Keeps the TypeScript mirror honest.
//!
//! Every type in this crate that crosses the Tauri IPC boundary has a
//! hand-written twin in `apps/desktop/src/types/`. Nothing enforces that they
//! agree: the boundary is `invoke<T>()` casting untyped JSON, so a mismatch is
//! invisible to both compilers and shows up only as `undefined` on screen —
//! silently, and usually as a blank panel rather than an error.
//!
//! That is not hypothetical. Four mirrors were found wrong in one week:
//!
//! * `ServerProfile` declared `name` / `host` / `user` / `createdAt` against
//!   Rust's `alias` / `hostname` / `username` / `created_at`
//! * `AuthMethod` was modelled as an externally tagged enum when the Rust type
//!   carries `#[serde(tag = "type")]`
//! * `CpuSample` declared two fields against a Rust type with eleven
//! * `RiskAssessment` declared `impact` / `requiresConfirmation` against
//!   `command` / `reasons` / `expected_impact` / `unknown_constructs`
//!
//! This test serialises a representative value of each type, takes the JSON
//! keys serde actually produces, and compares them with the field names the
//! TypeScript interface declares. It therefore checks the wire format rather
//! than the Rust source, which is what the frontend actually receives —
//! `#[serde(rename)]`, `flatten` and `tag` are all accounted for by
//! construction.
//!
//! It deliberately checks names, not types. Names are where the silent
//! failures have been, and a full type check would need a TypeScript parser.

use std::collections::BTreeSet;
use std::path::PathBuf;

use kyvon_core::*;

/// Where the mirror lives, relative to this crate.
fn types_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/desktop/src/types")
}

/// The field names serde emits for a value, at the top level.
fn wire_keys<T: serde::Serialize>(value: &T) -> BTreeSet<String> {
    let json = serde_json::to_value(value).expect("type is serialisable");
    match json {
        serde_json::Value::Object(map) => map.keys().cloned().collect(),
        other => panic!("expected a JSON object, got {other}"),
    }
}

/// The field names an `export interface` declares.
///
/// Comments are stripped first so a documented field is not mistaken for a
/// declaration, and nested braces are tracked so only top-level members count.
fn interface_fields(file: &str, name: &str) -> BTreeSet<String> {
    let source = std::fs::read_to_string(types_dir().join(file))
        .unwrap_or_else(|e| panic!("cannot read {file}: {e}"));

    let marker = format!("export interface {name} ");
    let start = source
        .find(&marker)
        .unwrap_or_else(|| panic!("{file} declares no `export interface {name}`"));
    let body_start = source[start..]
        .find('{')
        .map(|i| start + i + 1)
        .expect("interface has a body");

    let mut depth = 1usize;
    let mut body = String::new();
    for ch in source[body_start..].chars() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    break;
                }
            }
            _ => {}
        }
        body.push(ch);
    }

    let mut fields = BTreeSet::new();
    let mut in_block_comment = false;
    let mut nesting = 0usize;

    for raw in body.lines() {
        let mut line = raw.trim();

        if in_block_comment {
            match line.find("*/") {
                Some(end) => {
                    line = line[end + 2..].trim();
                    in_block_comment = false;
                }
                None => continue,
            }
        }
        if let Some(open) = line.find("/*") {
            let before = line[..open].trim().to_string();
            match line[open..].find("*/") {
                Some(end) => {
                    let after = &line[open + end + 2..];
                    line = Box::leak(format!("{before} {after}").into_boxed_str()).trim();
                }
                None => {
                    in_block_comment = true;
                    line = Box::leak(before.into_boxed_str());
                }
            }
        }
        if let Some(slashes) = line.find("//") {
            line = line[..slashes].trim();
        }
        if line.is_empty() {
            continue;
        }

        // Only members at the top level of this interface count.
        if nesting == 0 {
            if let Some((lhs, _)) = line.split_once(':') {
                let ident = lhs.trim().trim_end_matches('?').trim();
                if !ident.is_empty()
                    && ident
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
                {
                    fields.insert(ident.to_string());
                }
            }
        }
        nesting += line.matches('{').count();
        nesting = nesting.saturating_sub(line.matches('}').count());
    }

    fields
}

/// Assert one Rust value and one TypeScript interface describe the same shape.
#[track_caller]
fn assert_mirrors<T: serde::Serialize>(value: &T, file: &str, interface: &str) {
    let rust = wire_keys(value);
    let ts = interface_fields(file, interface);

    let missing: Vec<_> = rust.difference(&ts).cloned().collect();
    let extra: Vec<_> = ts.difference(&rust).cloned().collect();

    assert!(
        missing.is_empty() && extra.is_empty(),
        "`{interface}` in {file} has drifted from the Rust type.\n\
         \n\
         Sent by the backend but not declared in TypeScript: {missing:?}\n\
         Declared in TypeScript but never sent:             {extra:?}\n\
         \n\
         The frontend reads these fields off untyped JSON, so a mismatch \
         renders as `undefined` rather than failing. Fix the mirror to match \
         the wire format, checking the type's #[serde] attributes — not the \
         Rust field names, which rename and flatten can change."
    );
}

fn sample_host_facts() -> HostFacts {
    HostFacts {
        os_id: "ubuntu".into(),
        os_name: "Ubuntu 24.04 LTS".into(),
        os_version: "24.04".into(),
        arch: "x86_64".into(),
        kernel: "6.8.0".into(),
        hostname: "example".into(),
        package_manager: "apt".into(),
        cpu_cores: 4,
        memory_total_bytes: 1 << 32,
        uptime_secs: 1_000,
        cloud: None,
        capabilities: Capabilities::default(),
        probed_at: 0,
    }
}

#[test]
fn server_profile_mirror_matches() {
    let profile = ServerProfile {
        id: "srv_1".into(),
        alias: "example".into(),
        hostname: "example.invalid".into(),
        port: 22,
        username: "operator".into(),
        auth: AuthMethod::Agent,
        tags: vec!["production".into()],
        facts: Some(sample_host_facts()),
        created_at: 0,
        updated_at: 0,
    };
    assert_mirrors(&profile, "server.ts", "ServerProfile");
}

#[test]
fn host_facts_mirror_matches() {
    assert_mirrors(&sample_host_facts(), "server.ts", "HostFacts");
}

#[test]
fn cpu_sample_mirror_matches() {
    let cpu = CpuSample {
        total: 1.0,
        user: 1.0,
        system: 1.0,
        iowait: 0.0,
        steal: 0.0,
        idle: 97.0,
        nice: 0.0,
        irq: 0.0,
        cores: vec![1.0],
        load: [0.1, 0.2, 0.3],
        ctx_switches: Some(1),
        procs_running: Some(1),
        procs_blocked: Some(0),
    };
    assert_mirrors(&cpu, "telemetry.ts", "CpuSample");
}

#[test]
fn memory_sample_mirror_matches() {
    let mem = MemorySample {
        total_bytes: 1024,
        used_bytes: 512,
        available_bytes: 512,
        free_bytes: 256,
        cached_bytes: 128,
        buffers_bytes: 64,
        swap_total_bytes: 0,
        swap_used_bytes: 0,
        pressure_some_avg60: None,
    };
    assert_mirrors(&mem, "telemetry.ts", "MemorySample");
}

#[test]
fn network_sample_mirror_matches() {
    let iface = NetworkInterface {
        name: "eth0".into(),
        rx_bytes_per_sec: 1,
        tx_bytes_per_sec: 1,
        rx_packets_per_sec: 1,
        tx_packets_per_sec: 1,
        rx_errors: 0,
        tx_errors: 0,
        rx_dropped: 0,
        tx_dropped: 0,
    };
    assert_mirrors(&iface, "telemetry.ts", "NetworkInterface");
    assert_mirrors(
        &NetworkSample {
            interfaces: vec![iface],
        },
        "telemetry.ts",
        "NetworkSample",
    );
}

#[test]
fn agent_error_mirror_matches() {
    let err = AgentError {
        collector: "meminfo".into(),
        message: "unreadable".into(),
    };
    assert_mirrors(&err, "telemetry.ts", "AgentError");
}

#[test]
fn risk_assessment_mirror_matches() {
    let assessment = RiskAssessment {
        tier: RiskTier::Medium,
        command: "systemctl restart nginx".into(),
        reasons: vec!["restarts a running unit".into()],
        expected_impact: vec!["brief service interruption".into()],
        unknown_constructs: vec![],
    };
    assert_mirrors(&assessment, "risk.ts", "RiskAssessment");
}

/// `Capabilities` is deliberately not checked: it is a `#[serde(flatten)]`ed
/// map of probe name to boolean, so it has no fixed key set to compare. The
/// TypeScript side lists the probes the UI happens to read, which is a subset
/// by design rather than drift.
#[test]
fn capabilities_is_an_open_map_not_a_fixed_shape() {
    let json = serde_json::to_value(Capabilities::default()).unwrap();
    assert!(
        json.is_object(),
        "if Capabilities stops flattening into an object, it needs a mirror check like the rest"
    );
}
