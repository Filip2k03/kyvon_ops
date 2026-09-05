//! Per-connection state needed to turn cumulative counters into rates.
//!
//! `/proc/stat` and `/proc/net/dev` report totals since boot. A rate needs two
//! readings and the interval between them, so the desktop keeps the previous
//! reading for each connected server here. The first reading of a stream
//! produces no sample at all — reporting a rate from one data point would mean
//! inventing one.

use kyvon_core::{CpuSample, NetworkInterface, NetworkSample, TimestampMs};

use crate::proc::{CpuTimes, NetCounters, ProcStat};

#[derive(Debug, Default)]
pub struct TelemetryState {
    last_cpu: Option<(TimestampMs, ProcStat)>,
    last_net: Option<(TimestampMs, Vec<NetCounters>)>,
}

impl TelemetryState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Fold a new `/proc/stat` reading in.
    ///
    /// Returns `None` for the first reading, and for any reading where the
    /// counters went backwards — which happens across a reboot, and where a
    /// naive subtraction would produce a wildly wrong spike.
    pub fn push_cpu(
        &mut self,
        ts: TimestampMs,
        stat: ProcStat,
        load: [f32; 3],
    ) -> Option<CpuSample> {
        let sample = match &self.last_cpu {
            Some((_, prev)) => diff_cpu(&prev.aggregate, &stat.aggregate).map(|d| {
                let cores = prev
                    .cores
                    .iter()
                    .zip(stat.cores.iter())
                    .map(|(a, b)| diff_cpu(a, b).map(|c| c.busy).unwrap_or(0.0))
                    .collect();
                CpuSample {
                    total: d.busy,
                    user: d.user,
                    system: d.system,
                    iowait: d.iowait,
                    steal: d.steal,
                    idle: d.idle,
                    nice: d.nice,
                    irq: d.irq,
                    cores,
                    load,
                    ctx_switches: stat.ctx_switches,
                    procs_running: stat.procs_running,
                    procs_blocked: stat.procs_blocked,
                }
            }),
            None => None,
        };
        self.last_cpu = Some((ts, stat));
        sample
    }

    /// Fold a new `/proc/net/dev` reading in, producing per-second rates.
    ///
    /// Interfaces that appeared since the last reading are skipped for one
    /// interval rather than being reported as though their lifetime totals had
    /// all arrived at once.
    pub fn push_net(
        &mut self,
        ts: TimestampMs,
        counters: Vec<NetCounters>,
    ) -> Option<NetworkSample> {
        let sample = match &self.last_net {
            Some((prev_ts, prev)) => {
                let elapsed_ms = ts - prev_ts;
                if elapsed_ms <= 0 {
                    None
                } else {
                    let secs = elapsed_ms as f64 / 1000.0;
                    let interfaces: Vec<NetworkInterface> = counters
                        .iter()
                        .filter(|c| !c.is_loopback())
                        .filter_map(|c| {
                            let p = prev.iter().find(|x| x.name == c.name)?;
                            // A counter that went backwards means the
                            // interface or the host was reset.
                            if c.rx_bytes < p.rx_bytes || c.tx_bytes < p.tx_bytes {
                                return None;
                            }
                            Some(NetworkInterface {
                                name: c.name.clone(),
                                rx_bytes_per_sec: rate(c.rx_bytes - p.rx_bytes, secs),
                                tx_bytes_per_sec: rate(c.tx_bytes - p.tx_bytes, secs),
                                rx_packets_per_sec: rate(
                                    c.rx_packets.saturating_sub(p.rx_packets),
                                    secs,
                                ),
                                tx_packets_per_sec: rate(
                                    c.tx_packets.saturating_sub(p.tx_packets),
                                    secs,
                                ),
                                rx_errors: c.rx_errors,
                                tx_errors: c.tx_errors,
                                rx_dropped: c.rx_dropped,
                                tx_dropped: c.tx_dropped,
                            })
                        })
                        .collect();
                    (!interfaces.is_empty()).then_some(NetworkSample { interfaces })
                }
            }
            None => None,
        };
        self.last_net = Some((ts, counters));
        sample
    }

    /// Drop history, e.g. after a reconnect, so the next sample starts a fresh
    /// baseline instead of differencing across the gap.
    pub fn reset(&mut self) {
        self.last_cpu = None;
        self.last_net = None;
    }
}

fn rate(delta: u64, secs: f64) -> u64 {
    (delta as f64 / secs) as u64
}

struct CpuDelta {
    busy: f32,
    user: f32,
    system: f32,
    idle: f32,
    iowait: f32,
    steal: f32,
    nice: f32,
    irq: f32,
}

/// Percentage split of the jiffies elapsed between two readings.
///
/// Returns `None` when no time passed, or when the counters moved backwards
/// (a reboot): both cases would otherwise yield a nonsensical figure.
fn diff_cpu(prev: &CpuTimes, curr: &CpuTimes) -> Option<CpuDelta> {
    let total_prev = prev.total();
    let total_curr = curr.total();
    if total_curr <= total_prev {
        return None;
    }
    let total = (total_curr - total_prev) as f32;
    let pct = |a: u64, b: u64| (b.saturating_sub(a)) as f32 / total * 100.0;
    Some(CpuDelta {
        busy: (curr.busy().saturating_sub(prev.busy())) as f32 / total * 100.0,
        user: pct(prev.user, curr.user),
        system: pct(prev.system, curr.system),
        idle: pct(prev.idle, curr.idle),
        iowait: pct(prev.iowait, curr.iowait),
        steal: pct(prev.steal, curr.steal),
        nice: pct(prev.nice, curr.nice),
        irq: pct(prev.irq + prev.softirq, curr.irq + curr.softirq),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proc::parse_stat;

    fn stat(user: u64, system: u64, idle: u64, iowait: u64, steal: u64) -> ProcStat {
        ProcStat {
            aggregate: CpuTimes {
                user,
                system,
                idle,
                iowait,
                steal,
                ..Default::default()
            },
            ..Default::default()
        }
    }

    #[test]
    fn first_reading_yields_no_sample() {
        let mut s = TelemetryState::new();
        assert!(s
            .push_cpu(1000, stat(100, 50, 800, 50, 0), [0.0; 3])
            .is_none());
    }

    #[test]
    fn computes_utilisation_from_two_readings() {
        let mut s = TelemetryState::new();
        s.push_cpu(1000, stat(100, 50, 800, 50, 0), [0.0; 3]);
        // 1000 jiffies elapsed: 200 user, 100 system, 650 idle, 50 iowait.
        let out = s
            .push_cpu(2000, stat(300, 150, 1450, 100, 0), [1.5, 1.2, 1.0])
            .expect("second reading should produce a sample");
        assert!((out.user - 20.0).abs() < 0.01, "user was {}", out.user);
        assert!((out.system - 10.0).abs() < 0.01);
        assert!((out.iowait - 5.0).abs() < 0.01);
        // busy excludes both idle and iowait.
        assert!((out.total - 30.0).abs() < 0.01, "total was {}", out.total);
        assert_eq!(out.load, [1.5, 1.2, 1.0]);
    }

    #[test]
    fn counters_going_backwards_produce_no_sample() {
        let mut s = TelemetryState::new();
        s.push_cpu(1000, stat(1_000_000, 0, 0, 0, 0), [0.0; 3]);
        // Host rebooted: counters restart from near zero.
        assert!(s.push_cpu(2000, stat(10, 0, 0, 0, 0), [0.0; 3]).is_none());
        // ...and the next pair after the reboot works normally again.
        assert!(s
            .push_cpu(3000, stat(110, 0, 890, 0, 0), [0.0; 3])
            .is_some());
    }

    #[test]
    fn per_core_utilisation_is_reported() {
        let mut s = TelemetryState::new();
        let a = parse_stat("cpu  0 0 0 0 0 0 0 0\ncpu0 0 0 0 0 0 0 0 0\ncpu1 0 0 0 0 0 0 0 0\n")
            .unwrap();
        let b = parse_stat(
            "cpu  100 0 0 100 0 0 0 0\ncpu0 90 0 0 10 0 0 0 0\ncpu1 10 0 0 90 0 0 0 0\n",
        )
        .unwrap();
        s.push_cpu(1000, a, [0.0; 3]);
        let out = s.push_cpu(2000, b, [0.0; 3]).unwrap();
        assert_eq!(out.cores.len(), 2);
        assert!((out.cores[0] - 90.0).abs() < 0.01, "core0 {}", out.cores[0]);
        assert!((out.cores[1] - 10.0).abs() < 0.01, "core1 {}", out.cores[1]);
    }

    fn netc(name: &str, rx: u64, tx: u64) -> NetCounters {
        NetCounters {
            name: name.into(),
            rx_bytes: rx,
            tx_bytes: tx,
            ..Default::default()
        }
    }

    #[test]
    fn computes_network_rates_over_the_real_interval() {
        let mut s = TelemetryState::new();
        s.push_net(1000, vec![netc("eth0", 1_000_000, 500_000)]);
        // 2 seconds later, 10 MB received.
        let out = s
            .push_net(3000, vec![netc("eth0", 11_000_000, 1_500_000)])
            .unwrap();
        let eth = &out.interfaces[0];
        assert_eq!(eth.rx_bytes_per_sec, 5_000_000);
        assert_eq!(eth.tx_bytes_per_sec, 500_000);
    }

    #[test]
    fn loopback_is_excluded_from_throughput() {
        let mut s = TelemetryState::new();
        s.push_net(1000, vec![netc("lo", 0, 0), netc("eth0", 0, 0)]);
        let out = s
            .push_net(
                2000,
                vec![
                    netc("lo", 999_999_999, 999_999_999),
                    netc("eth0", 1000, 1000),
                ],
            )
            .unwrap();
        assert_eq!(out.interfaces.len(), 1);
        assert_eq!(out.interfaces[0].name, "eth0");
    }

    #[test]
    fn new_interfaces_are_skipped_for_one_interval() {
        let mut s = TelemetryState::new();
        s.push_net(1000, vec![netc("eth0", 0, 0)]);
        let out = s
            .push_net(
                2000,
                vec![netc("eth0", 100, 100), netc("wg0", 5_000_000, 5_000_000)],
            )
            .unwrap();
        // wg0 has no baseline, so its lifetime total is not reported as a rate.
        assert_eq!(out.interfaces.len(), 1);
        assert_eq!(out.interfaces[0].name, "eth0");
    }

    #[test]
    fn reset_clears_the_baseline() {
        let mut s = TelemetryState::new();
        s.push_cpu(1000, stat(100, 0, 900, 0, 0), [0.0; 3]);
        s.reset();
        assert!(s
            .push_cpu(2000, stat(200, 0, 1800, 0, 0), [0.0; 3])
            .is_none());
    }
}
