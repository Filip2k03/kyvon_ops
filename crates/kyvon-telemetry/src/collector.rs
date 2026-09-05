//! The remote collector and the framing it speaks.
//!
//! # What runs on the remote host
//!
//! [`COLLECTOR_SCRIPT`] is the entire remote-side program. It is POSIX `sh`,
//! it is short enough to read in full before you agree to run it, and the UI
//! shows it verbatim before installation (specification §10). It:
//!
//! * creates no files and opens no network sockets;
//! * changes nothing — every command it runs is a read;
//! * concatenates kernel interfaces into framed blocks on stdout;
//! * performs no arithmetic beyond a tick counter, so there is no calculation
//!   on the remote side that could be wrong.
//!
//! # Framing
//!
//! ```text
//! %%KYVON/1 HELLO <host>|<kernel>|<arch>|<space-separated capabilities>
//! %%KYVON/1 TICK <epoch_ms> <seq>
//! %%KYVON/1 SEC stat
//! cpu  2255124 1234 ...
//! %%KYVON/1 SEC meminfo
//! MemTotal:  16316576 kB
//! %%KYVON/1 END
//! ```
//!
//! Marker lines are the only lines the reader interprets; everything between
//! two markers is the previous section's body, byte for byte.

use kyvon_core::{KyvonError, Result, TimestampMs};

/// Bumped when the framing or the section set changes.
pub const COLLECTOR_VERSION: u32 = 1;

const MARKER: &str = "%%KYVON/1 ";

/// The complete remote-side collector. Shown to the operator before it runs.
pub const COLLECTOR_SCRIPT: &str = r#"#!/bin/sh
# ---------------------------------------------------------------------------
# KyvonOPS collector, protocol 1.
#
# Reads kernel interfaces and writes framed blocks to stdout. It creates no
# files, opens no sockets, and modifies nothing on this host. Every command
# below is a read. Terminate it by closing the SSH channel.
# ---------------------------------------------------------------------------
set -u

M='%%KYVON/1'
INTERVAL=${KYVON_INTERVAL:-1}

have() { command -v "$1" >/dev/null 2>&1; }
sec()  { echo "$M SEC $1"; }

# Millisecond clock, computed from two separate reads so that shells with
# 32-bit arithmetic do not overflow on `date +%s%N`.
HAS_NS=0
if [ "$(date +%N 2>/dev/null)" != "N" ] && [ -n "$(date +%N 2>/dev/null)" ]; then
  HAS_NS=1
fi
now_ms() {
  s=$(date +%s)
  if [ "$HAS_NS" = "1" ]; then
    n=$(date +%N)
    echo $(( s * 1000 + ${n#"${n%%[!0]*}"} / 1000000 ))
  else
    echo $(( s * 1000 ))
  fi
}

CAPS=""
for c in ss ip systemctl journalctl docker nginx ufw iptables nft psql mysql redis-cli node php python3; do
  have "$c" && CAPS="$CAPS $c"
done
[ -r /sys/fs/cgroup/cgroup.controllers ] && CAPS="$CAPS cgroup2"

echo "$M HELLO $(uname -n)|$(uname -r)|$(uname -m)|$CAPS"

n=0
while :; do
  echo "$M TICK $(now_ms) $n"

  sec stat;    cat /proc/stat    2>/dev/null
  sec loadavg; cat /proc/loadavg 2>/dev/null
  sec netdev;  cat /proc/net/dev 2>/dev/null

  if [ $(( n % 2 )) -eq 0 ]; then
    sec meminfo; cat /proc/meminfo 2>/dev/null
    sec pressure_mem; cat /proc/pressure/memory 2>/dev/null
  fi

  if [ $(( n % 3 )) -eq 0 ]; then
    sec ps
    ps -eo pid,ppid,user:32,pcpu,pmem,rss,stat,etimes,args --no-headers 2>/dev/null \
      | sort -k4 -rn | head -n 60
  fi

  if [ $(( n % 15 )) -eq 0 ] && have systemctl; then
    sec services
    systemctl list-units --type=service --all --plain --no-legend --no-pager 2>/dev/null
  fi

  if [ $(( n % 30 )) -eq 0 ]; then
    sec df;      df -PB1 2>/dev/null
    sec dfi;     df -Pi  2>/dev/null
    sec mounts;  cat /proc/mounts 2>/dev/null
    sec uptime;  cat /proc/uptime 2>/dev/null
    if have ss; then
      sec ss; ss -H -lntup 2>/dev/null
    fi
  fi

  echo "$M END"
  n=$(( n + 1 ))
  sleep "$INTERVAL"
done
"#;

/// One named section of a block: the literal bytes of a kernel interface or a
/// command's output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Section {
    pub name: String,
    pub body: String,
}

/// One tick of the collector: everything it reported at a single instant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub ts: TimestampMs,
    pub seq: u64,
    pub sections: Vec<Section>,
}

impl Block {
    pub fn section(&self, name: &str) -> Option<&str> {
        self.sections
            .iter()
            .find(|s| s.name == name)
            .map(|s| s.body.as_str())
    }
}

/// What a line handed to [`BlockReader::push_line`] completed, if anything.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Emit {
    /// The collector introduced itself.
    Hello {
        hostname: String,
        kernel: String,
        arch: String,
        capabilities: Vec<String>,
    },
    /// A complete tick.
    Block(Block),
}

/// Incremental reader over the collector's stdout.
///
/// Fed one line at a time so a partially received block never produces a
/// partially populated sample. Anything before the first `TICK` is ignored,
/// which makes the reader tolerant of login banners and shell noise that a
/// remote host may print before the collector starts.
#[derive(Debug, Default)]
pub struct BlockReader {
    ts: TimestampMs,
    seq: u64,
    sections: Vec<Section>,
    current: Option<Section>,
    in_block: bool,
    /// Lines that were neither markers nor inside a block. Kept so a failing
    /// collector's error output can be surfaced instead of vanishing.
    pub preamble: Vec<String>,
}

impl BlockReader {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push_line(&mut self, line: &str) -> Result<Option<Emit>> {
        let Some(rest) = line.strip_prefix(MARKER) else {
            if self.in_block {
                if let Some(sec) = self.current.as_mut() {
                    sec.body.push_str(line);
                    sec.body.push('\n');
                }
            } else if !line.trim().is_empty() {
                // Bound the preamble: a host that never starts the collector
                // must not grow this without limit.
                if self.preamble.len() < 64 {
                    self.preamble.push(line.to_string());
                }
            }
            return Ok(None);
        };

        let mut parts = rest.split_ascii_whitespace();
        let verb = parts.next().unwrap_or("");

        match verb {
            "HELLO" => {
                let payload = rest.strip_prefix("HELLO").unwrap_or("").trim();
                let f: Vec<&str> = payload.split('|').collect();
                if f.len() < 4 {
                    return Err(KyvonError::Parse {
                        what: "collector HELLO".into(),
                        reason: format!("expected 4 fields, found {}", f.len()),
                    });
                }
                Ok(Some(Emit::Hello {
                    hostname: f[0].trim().to_string(),
                    kernel: f[1].trim().to_string(),
                    arch: f[2].trim().to_string(),
                    capabilities: f[3].split_ascii_whitespace().map(str::to_string).collect(),
                }))
            }
            "TICK" => {
                self.ts = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
                self.seq = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
                self.sections.clear();
                self.current = None;
                self.in_block = true;
                self.preamble.clear();
                Ok(None)
            }
            "SEC" => {
                if let Some(done) = self.current.take() {
                    self.sections.push(done);
                }
                let name = parts.next().unwrap_or("").to_string();
                self.current = Some(Section {
                    name,
                    body: String::new(),
                });
                Ok(None)
            }
            "END" => {
                if !self.in_block {
                    return Ok(None);
                }
                if let Some(done) = self.current.take() {
                    self.sections.push(done);
                }
                self.in_block = false;
                Ok(Some(Emit::Block(Block {
                    ts: self.ts,
                    seq: self.seq,
                    sections: std::mem::take(&mut self.sections),
                })))
            }
            other => Err(KyvonError::Parse {
                what: "collector frame".into(),
                reason: format!("unknown marker verb `{other}`"),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(reader: &mut BlockReader, text: &str) -> Vec<Emit> {
        text.lines()
            .filter_map(|l| reader.push_line(l).transpose())
            .map(|r| r.unwrap())
            .collect()
    }

    const STREAM: &str = "\
Welcome to Ubuntu 24.04 LTS
%%KYVON/1 HELLO web-01|6.8.0-51-generic|x86_64| ss ip systemctl docker
%%KYVON/1 TICK 1770000000000 0
%%KYVON/1 SEC stat
cpu  100 0 50 800 50 0 0 0
%%KYVON/1 SEC meminfo
MemTotal:       1000 kB
MemAvailable:    400 kB
%%KYVON/1 END
%%KYVON/1 TICK 1770000001000 1
%%KYVON/1 SEC stat
cpu  200 0 100 1600 100 0 0 0
%%KYVON/1 END
";

    #[test]
    fn reads_hello_and_ignores_login_banner() {
        let mut r = BlockReader::new();
        let out = feed(&mut r, STREAM);
        match &out[0] {
            Emit::Hello {
                hostname,
                arch,
                capabilities,
                ..
            } => {
                assert_eq!(hostname, "web-01");
                assert_eq!(arch, "x86_64");
                assert!(capabilities.contains(&"docker".to_string()));
            }
            other => panic!("expected Hello, got {other:?}"),
        }
    }

    #[test]
    fn assembles_complete_blocks_only() {
        let mut r = BlockReader::new();
        let blocks: Vec<_> = feed(&mut r, STREAM)
            .into_iter()
            .filter_map(|e| match e {
                Emit::Block(b) => Some(b),
                _ => None,
            })
            .collect();
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].ts, 1_770_000_000_000);
        assert_eq!(blocks[0].seq, 0);
        assert_eq!(blocks[0].sections.len(), 2);
        assert_eq!(
            blocks[0].section("stat").unwrap().trim(),
            "cpu  100 0 50 800 50 0 0 0"
        );
        assert!(blocks[0].section("meminfo").unwrap().contains("MemTotal"));
    }

    #[test]
    fn a_truncated_block_produces_nothing() {
        let mut r = BlockReader::new();
        let out = feed(
            &mut r,
            "%%KYVON/1 TICK 1 0\n%%KYVON/1 SEC stat\ncpu 1 2 3 4\n",
        );
        assert!(out.is_empty(), "an unterminated block must not be emitted");
    }

    #[test]
    fn section_bodies_are_preserved_verbatim() {
        let mut r = BlockReader::new();
        let out = feed(
            &mut r,
            "%%KYVON/1 TICK 1 0\n%%KYVON/1 SEC ps\n  842 1 www-data  2.4 1.8 1024 S 5 nginx: worker\n%%KYVON/1 END\n",
        );
        let Emit::Block(b) = &out[0] else { panic!() };
        assert_eq!(
            b.section("ps").unwrap(),
            "  842 1 www-data  2.4 1.8 1024 S 5 nginx: worker\n"
        );
    }

    #[test]
    fn stderr_before_the_first_tick_is_retained_for_diagnosis() {
        let mut r = BlockReader::new();
        r.push_line("sh: 1: /proc/stat: Permission denied").unwrap();
        assert_eq!(r.preamble.len(), 1);
    }

    #[test]
    fn unknown_marker_verbs_are_reported_not_ignored() {
        let mut r = BlockReader::new();
        assert!(r.push_line("%%KYVON/1 WAT something").is_err());
    }

    /// The script must not contain a command that changes remote state. This
    /// is the guard that keeps a future edit honest.
    #[test]
    fn collector_script_only_reads() {
        const FORBIDDEN: &[&str] = &[
            "rm ",
            "mv ",
            "cp ",
            "chmod",
            "chown",
            "mkdir",
            "touch",
            "systemctl start",
            "systemctl stop",
            "systemctl restart",
            "curl",
            "wget",
            "apt",
            "yum",
            "dnf",
            ">>",
            "tee ",
        ];
        for f in FORBIDDEN {
            assert!(
                !COLLECTOR_SCRIPT.contains(f),
                "collector script contains `{f}`, which is not a read-only operation"
            );
        }
        // A single `>` only ever appears as part of a redirect to /dev/null.
        for (i, line) in COLLECTOR_SCRIPT.lines().enumerate() {
            if let Some(pos) = line.find('>') {
                let after = &line[pos..];
                assert!(
                    after.starts_with(">/dev/null") || after.starts_with("> /dev/null"),
                    "line {} redirects somewhere other than /dev/null: {line}",
                    i + 1
                );
            }
        }
    }
}
