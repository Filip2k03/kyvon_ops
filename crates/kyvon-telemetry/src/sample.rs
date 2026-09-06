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

use kyvon_core::Frame;

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
