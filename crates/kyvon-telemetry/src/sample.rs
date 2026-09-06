//! Turning one collector [`Block`] into typed samples.
//!
//! This is the join between the two halves of the crate. [`crate::proc`] knows
//! how to read a single kernel interface, [`crate::state`] knows how to turn
//! two readings into a rate, and this module walks a block's sections and
//! drives both.
//!
//! Three rules hold throughout, and the tests below pin each one:
//!
//! * **A missing section is missing, not zero.** A host without
//!   `/proc/pressure` or without `df` yields no sample for that signal rather
//!   than a plausible-looking `0`. Reporting 0% memory pressure on a kernel
//!   that cannot measure it is exactly the fabrication §108 forbids.
//! * **A malformed section does not discard the block.** One unparseable
//!   section costs that signal only; CPU is still reported when `df` is
//!   garbled. A collector that half-works is more useful than one that
//!   silently reports nothing.
//! * **Rates need two readings.** The first block after connecting produces no
//!   CPU or network sample at all, because a rate computed from one reading
//!   would be an invention.
//!
//! The actual walk lives in [`crate::protocol::block_to_frames`]; this module
//! is the stable entry point and the home of the tests that pin those rules.
//! An earlier version of this function handled only CPU, memory and network,
//! which is why the desktop's process, storage and port screens received
//! nothing even though the collector was shipping `ps`, `df` and `ss`.

use kyvon_core::{Frame, Payload};

use crate::collector::Block;
use crate::protocol::block_to_frames;
use crate::state::TelemetryState;

/// Convert one block into every sample it supports.
///
/// Returns frames in a stable order — CPU, memory, network, processes,
/// services, disk, ports — so a consumer appending to a series does not have
/// to sort. An empty result is legitimate: it means this block carried nothing
/// measurable, most often because it is the first one and every rate is still
/// undefined. A section that fails to parse yields a [`kyvon_core::Payload::Error`]
/// frame naming the collector, never a silently absent signal.
pub fn frames_from_block(block: &Block, state: &mut TelemetryState) -> Vec<Frame> {
    block_to_frames(state, block)
}

/// The time-series rows a frame contributes to the metric store.
///
/// Only quantities that are meaningful *over time* are emitted. Processes and
/// services are snapshots of a moment — a list of what was running — and
/// flattening them into numbered `f64` rows would produce a series whose
/// points refer to different things at each timestamp. They are deliberately
/// dropped here rather than encoded badly.
///
/// Percentages are stored as percentages and byte rates as bytes per second,
/// matching the key names documented in `0001_initial.sql`. Per-interface and
/// per-mount keys carry their identity in the key (`net.eth0.rx_bps`,
/// `disk./.used_pct`), so one server's series stay distinguishable without a
/// second lookup.
pub fn metric_rows(frame: &Frame) -> Vec<(String, kyvon_core::TimestampMs, f64)> {
    let ts = frame.ts;
    let mut rows = Vec::new();
    let mut push = |key: String, value: f64| {
        // A non-finite value is a computation that went wrong, not a
        // measurement; storing it would poison every aggregate over the
        // window that contains it.
        if value.is_finite() {
            rows.push((key, ts, value));
        }
    };

    match &frame.payload {
        Payload::Cpu(cpu) => {
            push("cpu.total".into(), cpu.total as f64);
            push("cpu.user".into(), cpu.user as f64);
            push("cpu.system".into(), cpu.system as f64);
            push("cpu.iowait".into(), cpu.iowait as f64);
            // Steal is the hypervisor taking cycles from this guest, which is
            // invisible in `cpu.total` and is exactly what explains a VPS
            // feeling slow while its own usage looks fine.
            push("cpu.steal".into(), cpu.steal as f64);
            push("load.1m".into(), cpu.load[0] as f64);
            push("load.5m".into(), cpu.load[1] as f64);
            push("load.15m".into(), cpu.load[2] as f64);
        }
        Payload::Memory(mem) => {
            push("mem.used_bytes".into(), mem.used_bytes as f64);
            if mem.total_bytes > 0 {
                let pct = mem.used_bytes as f64 / mem.total_bytes as f64 * 100.0;
                push("mem.used_pct".into(), pct);
            }
            if mem.swap_total_bytes > 0 {
                let pct = mem.swap_used_bytes as f64 / mem.swap_total_bytes as f64 * 100.0;
                push("mem.swap_used_pct".into(), pct);
            }
            // Absent on kernels without /proc/pressure, and absent stays
            // absent — a zero here would claim the kernel measured no stall.
            if let Some(pressure) = mem.pressure_some_avg60 {
                push("mem.pressure_some_avg60".into(), pressure as f64);
            }
        }
        Payload::Network(net) => {
            for iface in &net.interfaces {
                push(
                    format!("net.{}.rx_bps", iface.name),
                    iface.rx_bytes_per_sec as f64,
                );
                push(
                    format!("net.{}.tx_bps", iface.name),
                    iface.tx_bytes_per_sec as f64,
                );
            }
        }
        Payload::Disk(disk) => {
            for fs in &disk.filesystems {
                if fs.total_bytes > 0 {
                    let pct = fs.used_bytes as f64 / fs.total_bytes as f64 * 100.0;
                    push(format!("disk.{}.used_pct", fs.mount_point), pct);
                }
                push(
                    format!("disk.{}.available_bytes", fs.mount_point),
                    fs.available_bytes as f64,
                );
                // Inodes exhaust independently of space, and a full inode
                // table fails writes on a disk that looks half empty.
                if fs.inodes_total > 0 {
                    let pct = fs.inodes_used as f64 / fs.inodes_total as f64 * 100.0;
                    push(format!("disk.{}.inodes_used_pct", fs.mount_point), pct);
                }
            }
        }
        // Snapshots, not series. See the note above. Listening ports belong
        // here too: the set of open ports is a fact about a moment, and a
        // count of them would answer a question nobody asked while hiding
        // the change that actually matters — which port appeared.
        Payload::Processes(_)
        | Payload::Services(_)
        | Payload::Ports(_)
        | Payload::Hello(_)
        | Payload::Error(_) => {}
    }

    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::collector::{Block, Section};
    use kyvon_core::Payload;

    fn block(ts: i64, sections: &[(&str, &str)]) -> Block {
        Block {
            ts,
            seq: 0,
            sections: sections
                .iter()
                .map(|(name, body)| Section {
                    name: (*name).to_string(),
                    body: (*body).to_string(),
                })
                .collect(),
        }
    }

    const STAT_1: &str = "cpu  100 0 50 1000 0 0 0 0 0 0\ncpu0 100 0 50 1000 0 0 0 0 0 0\nctxt 500\nprocs_running 2\nprocs_blocked 0\n";
    const STAT_2: &str = "cpu  200 0 100 1800 0 0 0 0 0 0\ncpu0 200 0 100 1800 0 0 0 0 0 0\nctxt 900\nprocs_running 3\nprocs_blocked 0\n";
    const MEMINFO: &str = "MemTotal: 1024 kB\nMemFree: 256 kB\nMemAvailable: 512 kB\nBuffers: 64 kB\nCached: 128 kB\nSwapTotal: 512 kB\nSwapFree: 512 kB\n";

    fn frame(payload: Payload) -> Frame {
        Frame {
            version: kyvon_core::PROTOCOL_VERSION,
            ts: 1_000,
            payload,
        }
    }

    #[test]
    fn metric_keys_match_the_documented_convention() {
        // These strings are a storage contract: existing rows keep the old key
        // forever, so a rename silently splits one series into two.
        let cpu = frame(Payload::Cpu(kyvon_core::CpuSample {
            total: 4.91,
            user: 1.64,
            system: 2.80,
            iowait: 0.0,
            steal: 0.23,
            idle: 95.09,
            nice: 0.0,
            irq: 0.0,
            cores: vec![4.9],
            load: [0.38, 0.34, 0.30],
            ctx_switches: None,
            procs_running: None,
            procs_blocked: None,
        }));
        let rows = metric_rows(&cpu);
        let keys: Vec<&str> = rows.iter().map(|(k, _, _)| k.as_str()).collect();
        assert_eq!(
            keys,
            [
                "cpu.total",
                "cpu.user",
                "cpu.system",
                "cpu.iowait",
                "cpu.steal",
                "load.1m",
                "load.5m",
                "load.15m"
            ]
        );
        assert_eq!(rows[0].2, 4.91_f32 as f64);
    }

    #[test]
    fn percentages_are_derived_not_stored_raw() {
        let mem = frame(Payload::Memory(kyvon_core::MemorySample {
            total_bytes: 1000,
            used_bytes: 250,
            available_bytes: 750,
            free_bytes: 750,
            cached_bytes: 0,
            buffers_bytes: 0,
            swap_total_bytes: 200,
            swap_used_bytes: 50,
            pressure_some_avg60: None,
        }));
        let rows: std::collections::HashMap<_, _> = metric_rows(&mem)
            .into_iter()
            .map(|(k, _, v)| (k, v))
            .collect();
        assert_eq!(rows["mem.used_pct"], 25.0);
        assert_eq!(rows["mem.swap_used_pct"], 25.0);
        // Absent stays absent: a zero would claim the kernel measured no stall.
        assert!(!rows.contains_key("mem.pressure_some_avg60"));
    }

    #[test]
    fn a_zero_total_does_not_produce_a_nan_percentage() {
        // Division by a zero total is the obvious way to poison every
        // aggregate over the window containing it.
        let mem = frame(Payload::Memory(kyvon_core::MemorySample {
            total_bytes: 0,
            used_bytes: 0,
            available_bytes: 0,
            free_bytes: 0,
            cached_bytes: 0,
            buffers_bytes: 0,
            swap_total_bytes: 0,
            swap_used_bytes: 0,
            pressure_some_avg60: None,
        }));
        for (key, _, value) in metric_rows(&mem) {
            assert!(value.is_finite(), "{key} produced a non-finite value");
        }
    }

    #[test]
    fn per_interface_and_per_mount_keys_carry_their_identity() {
        let net = frame(Payload::Network(kyvon_core::NetworkSample {
            interfaces: vec![kyvon_core::NetworkInterface {
                name: "eth0".into(),
                rx_bytes_per_sec: 1024,
                tx_bytes_per_sec: 512,
                rx_packets_per_sec: 0,
                tx_packets_per_sec: 0,
                rx_errors: 0,
                tx_errors: 0,
                rx_dropped: 0,
                tx_dropped: 0,
            }],
        }));
        let keys: Vec<String> = metric_rows(&net).into_iter().map(|(k, _, _)| k).collect();
        assert_eq!(keys, ["net.eth0.rx_bps", "net.eth0.tx_bps"]);
    }

    #[test]
    fn snapshots_are_not_stored_as_series() {
        // A list of what was running is a fact about a moment; numbering it
        // would make each timestamp refer to a different process.
        for payload in [
            Payload::Processes(kyvon_core::ProcessSample {
                processes: vec![],
                total: 0,
            }),
            Payload::Services(kyvon_core::ServiceSample { services: vec![] }),
        ] {
            assert!(metric_rows(&frame(payload)).is_empty());
        }
    }

    #[test]
    fn a_rate_needs_two_readings_so_the_first_block_reports_none() {
        let mut state = TelemetryState::new();

        let first = frames_from_block(&block(1_000, &[("stat", STAT_1)]), &mut state);
        assert!(
            !first.iter().any(|f| matches!(f.payload, Payload::Cpu(_))),
            "a CPU percentage from one reading would be invented"
        );

        let second = frames_from_block(&block(2_000, &[("stat", STAT_2)]), &mut state);
        assert!(
            second.iter().any(|f| matches!(f.payload, Payload::Cpu(_))),
            "the second reading has a delta to report"
        );
    }

    #[test]
    fn an_absent_pressure_section_is_none_rather_than_zero() {
        let mut state = TelemetryState::new();
        let frames = frames_from_block(&block(1_000, &[("meminfo", MEMINFO)]), &mut state);

        let Payload::Memory(mem) = &frames
            .iter()
            .find(|f| matches!(f.payload, Payload::Memory(_)))
            .expect("memory is a level and is reported from the first block")
            .payload
        else {
            unreachable!()
        };

        assert_eq!(
            mem.pressure_some_avg60, None,
            "a kernel without /proc/pressure must not be reported as 0% pressure"
        );
        assert_eq!(mem.total_bytes, 1024 * 1024);
    }

    #[test]
    fn one_malformed_section_does_not_cost_the_others() {
        let mut state = TelemetryState::new();
        // Prime the CPU delta so the second block can produce a rate.
        frames_from_block(&block(1_000, &[("stat", STAT_1)]), &mut state);

        let frames = frames_from_block(
            &block(
                2_000,
                &[
                    ("stat", STAT_2),
                    ("meminfo", "this is not meminfo output at all"),
                ],
            ),
            &mut state,
        );

        assert!(
            frames.iter().any(|f| matches!(f.payload, Payload::Cpu(_))),
            "a garbled meminfo must not suppress the CPU reading"
        );
        assert!(
            !frames
                .iter()
                .any(|f| matches!(f.payload, Payload::Memory(_))),
            "and must not invent a memory reading either"
        );
        assert!(
            frames.iter().any(|f| matches!(
                &f.payload,
                Payload::Error(e) if e.collector == "memory"
            )),
            "the failure is reported to the operator rather than swallowed"
        );
    }

    #[test]
    fn slow_cadence_sections_reach_the_desktop() {
        let mut state = TelemetryState::new();
        let frames = frames_from_block(
            &block(
                1_000,
                &[
                    ("ps", "  842     1 www-data  2.4  1.8 10240 S  5 nginx: worker process\n"),
                    ("df", "Filesystem 1B-blocks Used Available Capacity Mounted on\n/dev/vda1 100 60 40 60% /\n"),
                    ("dfi", "Filesystem Inodes IUsed IFree IUse% Mounted on\n/dev/vda1 1000 900 100 90% /\n"),
                    ("mounts", "/dev/vda1 / ext4 rw 0 0\n"),
                    ("ss", "tcp LISTEN 0 511 0.0.0.0:80 0.0.0.0:*\n"),
                ],
            ),
            &mut state,
        );
        let kinds: Vec<&str> = frames.iter().map(|f| f.payload.kind()).collect();
        assert_eq!(kinds, ["processes", "disk", "ports"]);
        let Payload::Disk(d) = &frames[1].payload else {
            unreachable!()
        };
        assert_eq!(
            d.filesystems[0].inodes_used, 900,
            "inode counts are merged from df -i"
        );
        assert_eq!(d.filesystems[0].fs_type, "ext4");
    }

    #[test]
    fn an_empty_block_yields_nothing_rather_than_zeroes() {
        let mut state = TelemetryState::new();
        assert!(frames_from_block(&block(1_000, &[]), &mut state).is_empty());
    }
}
