//! Parsers for the kernel interfaces under `/proc`.
//!
//! Each function takes the file's contents verbatim and returns a typed value
//! or a parse error naming the interface. Nothing here guesses: a field the
//! kernel did not report comes back as `None` or zero-with-a-known-meaning,
//! never as an invented number.

use kyvon_core::{KyvonError, Result};

fn parse_err(what: &str, reason: impl Into<String>) -> KyvonError {
    KyvonError::Parse {
        what: what.to_string(),
        reason: reason.into(),
    }
}

/// Cumulative CPU time counters, in USER_HZ jiffies, from one line of
/// `/proc/stat`.
///
/// Fields are cumulative since boot, so a single reading says nothing about
/// utilisation; two readings and the difference between them do.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CpuTimes {
    pub user: u64,
    pub nice: u64,
    pub system: u64,
    pub idle: u64,
    pub iowait: u64,
    pub irq: u64,
    pub softirq: u64,
    pub steal: u64,
}

impl CpuTimes {
    pub fn total(&self) -> u64 {
        self.user
            + self.nice
            + self.system
            + self.idle
            + self.iowait
            + self.irq
            + self.softirq
            + self.steal
    }

    /// Time not spent idle. `iowait` counts as idle here because the CPU was
    /// available — it was the disk that was busy, and folding iowait into
    /// "busy" is the usual way a dashboard overstates CPU load.
    pub fn busy(&self) -> u64 {
        self.total() - self.idle - self.iowait
    }
}

/// Everything drawn from a single read of `/proc/stat`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProcStat {
    pub aggregate: CpuTimes,
    /// Per-core counters, index = core number as reported by the kernel.
    pub cores: Vec<CpuTimes>,
    pub ctx_switches: Option<u64>,
    pub procs_running: Option<u32>,
    pub procs_blocked: Option<u32>,
}

pub fn parse_stat(contents: &str) -> Result<ProcStat> {
    let mut out = ProcStat::default();
    let mut saw_aggregate = false;

    for line in contents.lines() {
        let mut parts = line.split_ascii_whitespace();
        let Some(key) = parts.next() else { continue };

        if key == "cpu" || (key.starts_with("cpu") && key[3..].chars().all(|c| c.is_ascii_digit()))
        {
            let v: Vec<u64> = parts.filter_map(|p| p.parse().ok()).collect();
            if v.len() < 4 {
                return Err(parse_err(
                    "/proc/stat",
                    format!("cpu line `{line}` has fewer than 4 time fields"),
                ));
            }
            let times = CpuTimes {
                user: v[0],
                nice: v[1],
                system: v[2],
                idle: v[3],
                // Kernels before 2.6.11 stop at idle; later fields are optional.
                iowait: v.get(4).copied().unwrap_or(0),
                irq: v.get(5).copied().unwrap_or(0),
                softirq: v.get(6).copied().unwrap_or(0),
                steal: v.get(7).copied().unwrap_or(0),
            };
            if key == "cpu" {
                out.aggregate = times;
                saw_aggregate = true;
            } else {
                out.cores.push(times);
            }
            continue;
        }

        match key {
            "ctxt" => out.ctx_switches = parts.next().and_then(|v| v.parse().ok()),
            "procs_running" => out.procs_running = parts.next().and_then(|v| v.parse().ok()),
            "procs_blocked" => out.procs_blocked = parts.next().and_then(|v| v.parse().ok()),
            _ => {}
        }
    }

    if !saw_aggregate {
        return Err(parse_err("/proc/stat", "no aggregate `cpu` line found"));
    }
    Ok(out)
}

/// `/proc/meminfo`, in bytes. The file reports kibibytes; conversion happens
/// once, here, so no caller has to remember the unit.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MemInfo {
    pub total: u64,
    pub free: u64,
    pub available: u64,
    pub buffers: u64,
    pub cached: u64,
    pub swap_total: u64,
    pub swap_free: u64,
}

impl MemInfo {
    /// Memory genuinely committed, excluding reclaimable page cache.
    pub fn used(&self) -> u64 {
        self.total.saturating_sub(self.available)
    }

    pub fn swap_used(&self) -> u64 {
        self.swap_total.saturating_sub(self.swap_free)
    }
}

pub fn parse_meminfo(contents: &str) -> Result<MemInfo> {
    let mut m = MemInfo::default();
    let mut saw_total = false;

    for line in contents.lines() {
        let Some((key, rest)) = line.split_once(':') else {
            continue;
        };
        let kb: u64 = match rest
            .split_ascii_whitespace()
            .next()
            .and_then(|v| v.parse().ok())
        {
            Some(v) => v,
            None => continue,
        };
        let bytes = kb.saturating_mul(1024);
        match key {
            "MemTotal" => {
                m.total = bytes;
                saw_total = true;
            }
            "MemFree" => m.free = bytes,
            "MemAvailable" => m.available = bytes,
            "Buffers" => m.buffers = bytes,
            "Cached" => m.cached = bytes,
            "SwapTotal" => m.swap_total = bytes,
            "SwapFree" => m.swap_free = bytes,
            _ => {}
        }
    }

    if !saw_total {
        return Err(parse_err("/proc/meminfo", "no MemTotal field"));
    }
    // MemAvailable arrived in Linux 3.14. On older kernels approximate it the
    // way the kernel itself does, rather than silently reporting zero
    // available memory and painting the host as critical.
    if m.available == 0 {
        m.available = m.free + m.buffers + m.cached;
    }
    Ok(m)
}

/// `/proc/loadavg`: the 1, 5 and 15 minute run-queue averages.
pub fn parse_loadavg(contents: &str) -> Result<[f32; 3]> {
    let v: Vec<f32> = contents
        .split_ascii_whitespace()
        .take(3)
        .filter_map(|p| p.parse().ok())
        .collect();
    if v.len() < 3 {
        return Err(parse_err(
            "/proc/loadavg",
            format!("expected 3 load figures, found {}", v.len()),
        ));
    }
    Ok([v[0], v[1], v[2]])
}

/// `/proc/uptime`: seconds since boot.
pub fn parse_uptime(contents: &str) -> Result<u64> {
    contents
        .split_ascii_whitespace()
        .next()
        .and_then(|v| v.parse::<f64>().ok())
        .map(|v| v as u64)
        .ok_or_else(|| parse_err("/proc/uptime", "no uptime value"))
}

/// Cumulative per-interface counters from `/proc/net/dev`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NetCounters {
    pub name: String,
    pub rx_bytes: u64,
    pub rx_packets: u64,
    pub rx_errors: u64,
    pub rx_dropped: u64,
    pub tx_bytes: u64,
    pub tx_packets: u64,
    pub tx_errors: u64,
    pub tx_dropped: u64,
}

impl NetCounters {
    /// Loopback carries only host-local traffic and would otherwise dominate
    /// the throughput chart on any host running a local database.
    pub fn is_loopback(&self) -> bool {
        self.name == "lo"
    }
}

pub fn parse_net_dev(contents: &str) -> Result<Vec<NetCounters>> {
    let mut out = Vec::new();
    // The first two lines are column headers.
    for line in contents.lines().skip(2) {
        let Some((name, rest)) = line.split_once(':') else {
            continue;
        };
        let v: Vec<u64> = rest
            .split_ascii_whitespace()
            .map(|p| p.parse().unwrap_or(0))
            .collect();
        if v.len() < 16 {
            continue;
        }
        out.push(NetCounters {
            name: name.trim().to_string(),
            rx_bytes: v[0],
            rx_packets: v[1],
            rx_errors: v[2],
            rx_dropped: v[3],
            tx_bytes: v[8],
            tx_packets: v[9],
            tx_errors: v[10],
            tx_dropped: v[11],
        });
    }
    if out.is_empty() {
        return Err(parse_err("/proc/net/dev", "no interface rows"));
    }
    Ok(out)
}

/// PSI `some avg60` from `/proc/pressure/<resource>`, if the kernel provides
/// pressure stall information at all.
pub fn parse_pressure_some_avg60(contents: &str) -> Option<f32> {
    contents
        .lines()
        .find(|l| l.starts_with("some"))?
        .split_ascii_whitespace()
        .find_map(|f| f.strip_prefix("avg60="))?
        .parse()
        .ok()
}

/// `/etc/os-release`, as key/value pairs with quotes stripped.
pub fn parse_os_release(contents: &str) -> std::collections::BTreeMap<String, String> {
    contents
        .lines()
        .filter_map(|l| l.split_once('='))
        .map(|(k, v)| {
            (
                k.trim().to_string(),
                v.trim().trim_matches('"').trim_matches('\'').to_string(),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const STAT: &str = "\
cpu  2255124 1234 512340 98765432 45678 0 12345 6789 0 0
cpu0 563781 308 128085 24691358 11419 0 3086 1697 0 0
cpu1 563781 308 128085 24691358 11419 0 3086 1697 0 0
intr 114551404 
ctxt 1990473
btime 1770000000
processes 2915
procs_running 3
procs_blocked 1
";

    #[test]
    fn reads_aggregate_and_per_core_cpu() {
        let s = parse_stat(STAT).unwrap();
        assert_eq!(s.aggregate.user, 2255124);
        assert_eq!(s.aggregate.steal, 6789);
        assert_eq!(s.cores.len(), 2);
        assert_eq!(s.ctx_switches, Some(1990473));
        assert_eq!(s.procs_running, Some(3));
        assert_eq!(s.procs_blocked, Some(1));
    }

    #[test]
    fn iowait_is_not_counted_as_busy() {
        let t = CpuTimes {
            user: 10,
            idle: 80,
            iowait: 10,
            ..Default::default()
        };
        assert_eq!(t.total(), 100);
        assert_eq!(t.busy(), 10);
    }

    #[test]
    fn rejects_stat_without_aggregate_line() {
        assert!(parse_stat("intr 1\nctxt 2\n").is_err());
    }

    #[test]
    fn tolerates_short_cpu_lines_from_old_kernels() {
        let s = parse_stat("cpu  100 20 30 400\n").unwrap();
        assert_eq!(s.aggregate.idle, 400);
        assert_eq!(s.aggregate.steal, 0);
    }

    const MEMINFO: &str = "\
MemTotal:       16316576 kB
MemFree:          290156 kB
MemAvailable:    5432100 kB
Buffers:          123456 kB
Cached:          4321000 kB
SwapTotal:       2097148 kB
SwapFree:        1600000 kB
";

    #[test]
    fn converts_meminfo_to_bytes() {
        let m = parse_meminfo(MEMINFO).unwrap();
        assert_eq!(m.total, 16_316_576 * 1024);
        assert_eq!(m.available, 5_432_100 * 1024);
        assert_eq!(m.swap_used(), (2_097_148 - 1_600_000) * 1024);
    }

    #[test]
    fn used_memory_excludes_reclaimable_cache() {
        let m = parse_meminfo(MEMINFO).unwrap();
        // Naively `total - free` would claim ~15.3 GB used; the honest figure
        // uses MemAvailable and lands near 10.4 GB.
        assert_eq!(m.used(), (16_316_576 - 5_432_100) * 1024);
        assert!(m.used() < m.total - m.free);
    }

    #[test]
    fn approximates_available_on_pre_3_14_kernels() {
        let old = "MemTotal: 1000 kB\nMemFree: 100 kB\nBuffers: 50 kB\nCached: 200 kB\n";
        let m = parse_meminfo(old).unwrap();
        assert_eq!(m.available, 350 * 1024);
    }

    #[test]
    fn reads_load_average() {
        assert_eq!(
            parse_loadavg("1.72 1.43 1.21 2/451 12345\n").unwrap(),
            [1.72, 1.43, 1.21]
        );
    }

    const NETDEV: &str = "\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1234567    8901    0    0    0     0          0         0  1234567    8901    0    0    0     0       0          0
  eth0: 987654321 1234567    2    5    0     0          0         0  123456789  654321    1    3    0     0       0          0
";

    #[test]
    fn reads_interface_counters() {
        let n = parse_net_dev(NETDEV).unwrap();
        assert_eq!(n.len(), 2);
        let eth = n.iter().find(|i| i.name == "eth0").unwrap();
        assert_eq!(eth.rx_bytes, 987_654_321);
        assert_eq!(eth.tx_bytes, 123_456_789);
        assert_eq!(eth.rx_dropped, 5);
        assert!(n[0].is_loopback());
    }

    #[test]
    fn reads_memory_pressure_when_present() {
        let psi = "some avg10=0.00 avg60=1.23 avg300=0.42 total=123456\nfull avg10=0.00 avg60=0.10 avg300=0.05 total=1234\n";
        assert_eq!(parse_pressure_some_avg60(psi), Some(1.23));
        assert_eq!(parse_pressure_some_avg60(""), None);
    }

    #[test]
    fn reads_os_release() {
        let osr = "NAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nID=ubuntu\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n";
        let m = parse_os_release(osr);
        assert_eq!(m.get("ID").unwrap(), "ubuntu");
        assert_eq!(m.get("PRETTY_NAME").unwrap(), "Ubuntu 24.04.1 LTS");
    }
}
