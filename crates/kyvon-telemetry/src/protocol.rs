//! The NDJSON telemetry protocol (specification §13).
//!
//! [`kyvon_core::Frame`] is the single representation of a sample everywhere
//! above the parsers: it is what the aggregator stores, what crosses Tauri IPC
//! to the frontend, and what a future compiled agent will emit directly on the
//! wire. Keeping one shape means the frontend's chart code cannot drift from
//! what the collector actually measured.

use kyvon_core::{
    caps, Capabilities, Frame, KyvonError, Payload, Result, TimestampMs, PROTOCOL_VERSION,
};

use crate::collector::{Block, Emit};
use crate::state::TelemetryState;
use crate::{commands, proc};

/// Serialise a frame as one NDJSON line, without the trailing newline.
pub fn encode_frame(frame: &Frame) -> Result<String> {
    serde_json::to_string(frame).map_err(Into::into)
}

/// Parse one NDJSON line into a frame.
pub fn decode_line(line: &str) -> Result<Frame> {
    let frame: Frame = serde_json::from_str(line.trim())?;
    if frame.version != PROTOCOL_VERSION {
        return Err(KyvonError::Parse {
            what: "telemetry frame".into(),
            reason: format!(
                "frame speaks protocol {} but this build speaks {PROTOCOL_VERSION}",
                frame.version
            ),
        });
    }
    Ok(frame)
}

fn frame(ts: TimestampMs, payload: Payload) -> Frame {
    Frame {
        version: PROTOCOL_VERSION,
        ts,
        payload,
    }
}

/// Turn one collector block into typed frames.
///
/// Sections the block did not carry produce no frame — a cadence that only
/// samples the filesystem every 30 seconds must not be padded out with
/// repeated or interpolated values. A section that fails to parse produces an
/// [`Payload::Error`] frame naming the collector, so the failure reaches the
/// operator instead of being swallowed.
pub fn block_to_frames(state: &mut TelemetryState, block: &Block) -> Vec<Frame> {
    let mut frames = Vec::new();
    let ts = block.ts;

    if let Some(stat_body) = block.section("stat") {
        let load = block
            .section("loadavg")
            .and_then(|b| proc::parse_loadavg(b).ok())
            .unwrap_or([0.0; 3]);
        match proc::parse_stat(stat_body) {
            Ok(stat) => {
                if let Some(sample) = state.push_cpu(ts, stat, load) {
                    frames.push(frame(ts, Payload::Cpu(sample)));
                }
            }
            Err(e) => frames.push(error_frame(ts, "cpu", e)),
        }
    }

    if let Some(body) = block.section("meminfo") {
        match proc::parse_meminfo(body) {
            Ok(m) => frames.push(frame(
                ts,
                Payload::Memory(kyvon_core::MemorySample {
                    total_bytes: m.total,
                    used_bytes: m.used(),
                    available_bytes: m.available,
                    free_bytes: m.free,
                    cached_bytes: m.cached,
                    buffers_bytes: m.buffers,
                    swap_total_bytes: m.swap_total,
                    swap_used_bytes: m.swap_used(),
                    pressure_some_avg60: block
                        .section("pressure_mem")
                        .and_then(proc::parse_pressure_some_avg60),
                }),
            )),
            Err(e) => frames.push(error_frame(ts, "memory", e)),
        }
    }

    if let Some(body) = block.section("netdev") {
        match proc::parse_net_dev(body) {
            Ok(counters) => {
                if let Some(sample) = state.push_net(ts, counters) {
                    frames.push(frame(ts, Payload::Network(sample)));
                }
            }
            Err(e) => frames.push(error_frame(ts, "network", e)),
        }
    }

    if let Some(body) = block.section("ps") {
        match commands::parse_ps(body) {
            Ok(processes) => {
                let total = processes.len() as u32;
                frames.push(frame(
                    ts,
                    Payload::Processes(kyvon_core::ProcessSample { processes, total }),
                ));
            }
            Err(e) => frames.push(error_frame(ts, "processes", e)),
        }
    }

    if let Some(body) = block.section("services") {
        match commands::parse_systemctl_units(body) {
            Ok(services) => frames.push(frame(
                ts,
                Payload::Services(kyvon_core::ServiceSample { services }),
            )),
            Err(e) => frames.push(error_frame(ts, "services", e)),
        }
    }

    if let Some(body) = block.section("df") {
        match commands::parse_df(body) {
            Ok(mut filesystems) => {
                if let Some(mounts) = block.section("mounts") {
                    commands::merge_fs_types(&mut filesystems, mounts);
                }
                if let Some(dfi) = block.section("dfi") {
                    commands::merge_inode_counts(&mut filesystems, dfi);
                }
                filesystems.retain(|f| f.is_real_storage());
                frames.push(frame(
                    ts,
                    Payload::Disk(kyvon_core::DiskSample { filesystems }),
                ));
            }
            Err(e) => frames.push(error_frame(ts, "disk", e)),
        }
    }

    // `ss` is only present when the host has it; a block without the section
    // yields no frame, so "unknown" never reads as "nothing listening".
    if let Some(body) = block.section("ss") {
        match commands::parse_ss(body) {
            Ok(ports) => frames.push(frame(ts, Payload::Ports(kyvon_core::PortSample { ports }))),
            Err(e) => frames.push(error_frame(ts, "ports", e)),
        }
    }

    frames
}

fn error_frame(ts: TimestampMs, collector: &str, e: KyvonError) -> Frame {
    frame(
        ts,
        Payload::Error(kyvon_core::AgentError {
            collector: collector.to_string(),
            message: e.to_string(),
        }),
    )
}

/// Map the collector's self-reported command list onto capability keys.
pub fn capabilities_from_hello(emit: &Emit) -> Capabilities {
    let Emit::Hello { capabilities, .. } = emit else {
        return Capabilities::new();
    };
    let mut c = Capabilities::new();
    // /proc is a precondition for the collector running at all.
    c.set(caps::PROC, true);
    for (key, probe) in [
        (caps::SS, "ss"),
        (caps::IP, "ip"),
        (caps::SYSTEMD, "systemctl"),
        (caps::JOURNALCTL, "journalctl"),
        (caps::DOCKER, "docker"),
        (caps::NGINX, "nginx"),
        (caps::UFW, "ufw"),
        (caps::IPTABLES, "iptables"),
        (caps::NFTABLES, "nft"),
        (caps::POSTGRES, "psql"),
        (caps::MYSQL, "mysql"),
        (caps::REDIS, "redis-cli"),
        (caps::NODE, "node"),
        (caps::PHP, "php"),
        (caps::PYTHON, "python3"),
    ] {
        c.set(key, capabilities.iter().any(|x| x == probe));
    }
    c
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::collector::BlockReader;

    /// Drive the whole path a real stream takes: raw collector output in,
    /// typed frames out.
    fn frames_from(stream: &str) -> Vec<Frame> {
        let mut reader = BlockReader::new();
        let mut state = TelemetryState::new();
        let mut out = Vec::new();
        for line in stream.lines() {
            if let Ok(Some(Emit::Block(b))) = reader.push_line(line) {
                out.extend(block_to_frames(&mut state, &b));
            }
        }
        out
    }

    const STREAM: &str = "\
%%KYVON/1 TICK 1770000000000 0
%%KYVON/1 SEC stat
cpu  100 0 50 800 50 0 0 0
%%KYVON/1 SEC loadavg
0.50 0.40 0.30 1/200 999
%%KYVON/1 SEC meminfo
MemTotal:       1048576 kB
MemFree:         102400 kB
MemAvailable:    524288 kB
Buffers:          20480 kB
Cached:          409600 kB
SwapTotal:            0 kB
SwapFree:             0 kB
%%KYVON/1 SEC netdev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 1000000    1000    0    0    0     0          0         0   500000     500    0    0    0     0       0          0
%%KYVON/1 SEC df
Filesystem     1B-blocks        Used   Available Capacity Mounted on
/dev/vda1   105089261568 71234567890 28456789012      72% /
%%KYVON/1 SEC mounts
/dev/vda1 / ext4 rw,relatime 0 0
%%KYVON/1 SEC ss
tcp   LISTEN 0      511          0.0.0.0:80        0.0.0.0:*    users:((\"nginx\",pid=842,fd=6))
tcp   LISTEN 0      4096       127.0.0.1:5432      0.0.0.0:*
%%KYVON/1 END
%%KYVON/1 TICK 1770000001000 1
%%KYVON/1 SEC stat
cpu  300 0 150 1450 100 0 0 0
%%KYVON/1 SEC loadavg
1.72 1.43 1.21 3/210 1000
%%KYVON/1 SEC netdev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 6000000    2000    0    0    0     0          0         0  1500000     900    0    0    0     0       0          0
%%KYVON/1 END
";

    #[test]
    fn produces_cpu_only_once_a_baseline_exists() {
        let frames = frames_from(STREAM);
        let cpu: Vec<_> = frames
            .iter()
            .filter_map(|f| match &f.payload {
                Payload::Cpu(c) => Some(c),
                _ => None,
            })
            .collect();
        assert_eq!(cpu.len(), 1, "the first tick has no interval to measure");
        assert!((cpu[0].total - 30.0).abs() < 0.01, "total {}", cpu[0].total);
        assert_eq!(cpu[0].load, [1.72, 1.43, 1.21]);
    }

    #[test]
    fn memory_is_reported_from_the_first_tick() {
        let frames = frames_from(STREAM);
        let mem = frames
            .iter()
            .find_map(|f| match &f.payload {
                Payload::Memory(m) => Some(m),
                _ => None,
            })
            .expect("memory frame");
        assert_eq!(mem.total_bytes, 1_048_576 * 1024);
        assert!((mem.utilisation_pct() - 50.0).abs() < 0.01);
    }

    #[test]
    fn network_rates_use_the_tick_interval() {
        let frames = frames_from(STREAM);
        let net = frames
            .iter()
            .find_map(|f| match &f.payload {
                Payload::Network(n) => Some(n),
                _ => None,
            })
            .expect("network frame");
        // 5 MB over 1 second.
        assert_eq!(net.interfaces[0].rx_bytes_per_sec, 5_000_000);
    }

    #[test]
    fn pseudo_filesystems_are_dropped() {
        let frames = frames_from(STREAM);
        let disk = frames
            .iter()
            .find_map(|f| match &f.payload {
                Payload::Disk(d) => Some(d),
                _ => None,
            })
            .expect("disk frame");
        assert_eq!(disk.filesystems.len(), 1);
        assert_eq!(disk.filesystems[0].fs_type, "ext4");
    }

    #[test]
    fn listening_sockets_carry_exposure_and_owner_when_visible() {
        let frames = frames_from(STREAM);
        let ports = frames
            .iter()
            .find_map(|f| match &f.payload {
                Payload::Ports(p) => Some(p),
                _ => None,
            })
            .expect("ports frame");
        assert_eq!(ports.ports.len(), 2);
        let web = &ports.ports[0];
        assert_eq!(web.port, 80);
        assert_eq!(web.exposure, kyvon_core::Exposure::AllInterfaces);
        assert_eq!(web.process.as_deref(), Some("nginx"));
        assert_eq!(web.pid, Some(842));
        let db = &ports.ports[1];
        assert_eq!(db.exposure, kyvon_core::Exposure::Loopback);
        assert_eq!(db.process, None, "an unseen owner is absent, not guessed");
    }

    #[test]
    fn a_host_without_ss_produces_no_ports_frame() {
        let stream = "%%KYVON/1 TICK 1 0\n%%KYVON/1 SEC meminfo\nMemTotal: 1024 kB\nMemFree: 512 kB\nMemAvailable: 512 kB\n%%KYVON/1 END\n";
        let frames = frames_from(stream);
        assert!(
            !frames
                .iter()
                .any(|f| matches!(f.payload, Payload::Ports(_))),
            "unknown must not be reported as an empty socket list"
        );
    }

    #[test]
    fn a_broken_section_yields_an_error_frame_not_silence() {
        let broken = "%%KYVON/1 TICK 1 0\n%%KYVON/1 SEC meminfo\ngarbage\n%%KYVON/1 END\n";
        let frames = frames_from(broken);
        assert!(matches!(frames[0].payload, Payload::Error(_)));
    }

    #[test]
    fn frames_round_trip_through_ndjson() {
        for f in frames_from(STREAM) {
            let line = encode_frame(&f).unwrap();
            assert!(!line.contains('\n'), "a frame must be a single line");
            let back = decode_line(&line).unwrap();
            assert_eq!(back.ts, f.ts);
            assert_eq!(back.payload.kind(), f.payload.kind());
        }
    }

    #[test]
    fn a_frame_from_a_future_protocol_is_rejected() {
        let line = r#"{"v":99,"ts":1,"type":"cpu","data":{"total":1.0,"user":1.0,"system":0.0,"iowait":0.0,"steal":0.0,"idle":99.0,"load":[0.0,0.0,0.0]}}"#;
        assert!(decode_line(line).is_err());
    }

    #[test]
    fn maps_reported_commands_to_capabilities() {
        let hello = Emit::Hello {
            hostname: "h".into(),
            kernel: "k".into(),
            arch: "x86_64".into(),
            capabilities: vec!["ss".into(), "systemctl".into(), "docker".into()],
        };
        let c = capabilities_from_hello(&hello);
        assert!(c.has(caps::SYSTEMD));
        assert!(c.has(caps::DOCKER));
        assert!(
            !c.has(caps::NGINX),
            "an unreported command must read as absent"
        );
    }
}
