//! Collect one real telemetry sample from a live host.
//!
//! This exercises the production path end to end — `russh` transport, host-key
//! verification, agent authentication, the POSIX collector piped over stdin,
//! the block reader, and `frames_from_block` — rather than approximating it
//! with `ssh` in a shell. An approximation would prove the host answers, not
//! that KyvonOPS can read it.
//!
//! Host-key verification is real. The expected key is passed in and compared
//! byte for byte; there is no bypass, because a verification step that can be
//! skipped for convenience is not a verification step.
//!
//! Read-only: the collector concatenates `/proc` and `/sys` reads and changes
//! nothing on the host.
//!
//! ```sh
//! KYVON_HOST=… KYVON_USER=… KYVON_HOSTKEY="$(sqlite3 … 'SELECT public_key …')" \
//!   cargo run -p kyvon-ssh --example live_telemetry
//! ```

use std::sync::Arc;
use std::time::Duration;

use kyvon_core::{AuthMethod, ServerProfile};
use kyvon_ssh::session::StreamItem;
use kyvon_ssh::{HostKeyVerifier, PresentedKey, SshSession, Verdict};
use kyvon_telemetry::collector::{BlockReader, Emit, COLLECTOR_SCRIPT};
use kyvon_telemetry::{frames_from_block, TelemetryState};

/// Trusts exactly one key: the one already recorded in the operator's store.
struct ExpectedKey(String);

#[async_trait::async_trait]
impl HostKeyVerifier for ExpectedKey {
    async fn verify(&self, host: &str, _port: u16, key: &PresentedKey) -> Verdict {
        if key.openssh.trim() == self.0.trim() {
            println!(
                "  host key      MATCHES the trusted record ({})",
                key.fingerprint
            );
            Verdict::Trust
        } else {
            eprintln!("  host key      MISMATCH for {host}");
            eprintln!("                presented {}", key.fingerprint);
            Verdict::Reject
        }
    }
}

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("{name} must be set"))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let host = env("KYVON_HOST");
    let user = env("KYVON_USER");
    let expected = env("KYVON_HOSTKEY");
    let port: u16 = std::env::var("KYVON_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(22);

    let now = kyvon_core::now_ms();
    let profile = ServerProfile {
        id: "live-check".into(),
        alias: "live-check".into(),
        hostname: host.clone(),
        port,
        username: user.clone(),
        // The agent holds the key; nothing secret passes through this process.
        auth: AuthMethod::Agent,
        tags: vec![],
        facts: None,
        created_at: now,
        updated_at: now,
    };

    println!("connecting    {user}@{host}:{port} (ssh-agent)");
    let session = SshSession::connect(&profile, Arc::new(ExpectedKey(expected)), None).await?;
    println!("  authenticated");

    // `sh -s` reads the collector from stdin, so nothing is written to the host.
    let mut stream = session
        .stream("sh -s", Some(COLLECTOR_SCRIPT.as_bytes()))
        .await?;
    println!("  collector streaming\n");

    let mut reader = BlockReader::new();
    let mut state = TelemetryState::new();
    let mut blocks = 0usize;

    // A rate needs two readings, so the first block yields no CPU sample by
    // design. Read until a real sample appears or the budget runs out.
    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
    while tokio::time::Instant::now() < deadline {
        let Some(item) = tokio::time::timeout_at(deadline, stream.next())
            .await
            .unwrap_or(None)
        else {
            break;
        };
        match item {
            StreamItem::Line(line) => match reader.push_line(&line)? {
                Some(Emit::Hello {
                    hostname,
                    kernel,
                    arch,
                    capabilities,
                }) => {
                    println!("HELLO from the collector");
                    println!("  hostname      {hostname}");
                    println!("  kernel        {kernel}");
                    println!("  arch          {arch}");
                    println!("  capabilities  {}\n", capabilities.join(", "));
                }
                Some(Emit::Block(block)) => {
                    blocks += 1;
                    let frames = frames_from_block(&block, &mut state);
                    println!(
                        "block {blocks}: {} section(s) -> {} frame(s)",
                        block.sections.len(),
                        frames.len()
                    );
                    for frame in &frames {
                        println!("  {}", serde_json::to_string(&frame.payload)?);
                    }
                    // Two blocks means a delta existed and a rate was computed.
                    if blocks >= 2 && !frames.is_empty() {
                        println!("\nMEASURED: {} frame(s) from real host data.", frames.len());
                        return Ok(());
                    }
                }
                None => {}
            },
            StreamItem::Exited(status) => {
                eprintln!("collector exited early with status {status:?}");
                if !reader.preamble.is_empty() {
                    eprintln!("stderr: {}", reader.preamble.join(" "));
                }
                std::process::exit(1);
            }
        }
    }

    eprintln!("no sample within the time budget ({blocks} block(s) seen)");
    std::process::exit(1);
}
