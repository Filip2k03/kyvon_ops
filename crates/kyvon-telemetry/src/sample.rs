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

use kyvon_core::{Frame, MemorySample, Payload, PROTOCOL_VERSION};

use crate::collector::Block;
use crate::proc;
use crate::state::TelemetryState;

/// Convert one block into every sample it supports.
///
/// Returns frames in a stable order — CPU, memory, network — so a consumer
/// appending to a series does not have to sort. An empty result is legitimate:
/// it means this block carried nothing measurable, most often because it is
/// the first one and every rate is still undefined.
pub fn frames_from_block(block: &Block, state: &mut TelemetryState) -> Vec<Frame> {
    let mut frames = Vec::new();
    let ts = block.ts;

    // CPU needs both /proc/stat and /proc/loadavg. Load average is not a rate,
    // but it belongs to the same sample, so a missing loadavg degrades to
    // zeroes there rather than costing the whole CPU reading.
    if let Some(stat) = block.section("stat").and_then(|s| proc::parse_stat(s).ok()) {
        let load = block
            .section("loadavg")
            .and_then(|s| proc::parse_loadavg(s).ok())
            .unwrap_or([0.0; 3]);
        if let Some(cpu) = state.push_cpu(ts, stat, load) {
            frames.push(frame(ts, Payload::Cpu(cpu)));
        }
    }

    // Memory is a level, not a rate, so it is reported from the first block.
    if let Some(mem) = block
        .section("meminfo")
        .and_then(|s| proc::parse_meminfo(s).ok())
    {
        frames.push(frame(
            ts,
            Payload::Memory(MemorySample {
                // `parse_meminfo` has already converted /proc/meminfo's kB
                // into bytes, so no scaling happens here.
                total_bytes: mem.total,
                used_bytes: mem.used(),
                available_bytes: mem.available,
                free_bytes: mem.free,
                cached_bytes: mem.cached,
                buffers_bytes: mem.buffers,
                swap_total_bytes: mem.swap_total,
                swap_used_bytes: mem.swap_used(),
                // `None` when /proc/pressure is absent — an older kernel
                // cannot measure this, and 0.0 would claim it had.
                pressure_some_avg60: block
                    .section("pressure_mem")
                    .and_then(proc::parse_pressure_some_avg60),
            }),
        ));
    }

    if let Some(counters) = block
        .section("netdev")
        .and_then(|s| proc::parse_net_dev(s).ok())
    {
        if let Some(net) = state.push_net(ts, counters) {
            frames.push(frame(ts, Payload::Network(net)));
        }
    }

    frames
}

fn frame(ts: kyvon_core::TimestampMs, payload: Payload) -> Frame {
    Frame {
        version: PROTOCOL_VERSION,
        ts,
        payload,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::collector::{Block, Section};

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
    }

    #[test]
    fn an_empty_block_yields_nothing_rather_than_zeroes() {
        let mut state = TelemetryState::new();
        assert!(frames_from_block(&block(1_000, &[]), &mut state).is_empty());
    }
}
