//! Parsers for the small set of command outputs the collector ships.
//!
//! These exist because the kernel offers no stable interface for the fact in
//! question: filesystem free space needs `statfs` per mount, listening sockets
//! need inode-to-process correlation, and unit state belongs to systemd. Each
//! parser is written against the machine-readable form of the command
//! (`df -P`, `ss -H`, `systemctl --plain --no-legend`) rather than its
//! human-facing output, because those forms are specified not to change.

use kyvon_core::{
    Exposure, FilesystemInfo, KyvonError, PortInfo, ProcessInfo, Result, ServiceInfo,
};

fn parse_err(what: &str, reason: impl Into<String>) -> KyvonError {
    KyvonError::Parse {
        what: what.to_string(),
        reason: reason.into(),
    }
}

/// `df -PB1` — POSIX output format, sizes in bytes.
///
/// POSIX format guarantees exactly six columns and one line per filesystem,
/// which is what makes this parseable; the default human-readable output does
/// neither.
pub fn parse_df(contents: &str) -> Result<Vec<FilesystemInfo>> {
    let mut out = Vec::new();
    for line in contents.lines().skip(1) {
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        if f.len() < 6 {
            continue;
        }
        // The mount point is the last field and may contain spaces, so take
        // everything from field 5 onwards.
        let mount = f[5..].join(" ");
        out.push(FilesystemInfo {
            device: f[0].to_string(),
            fs_type: String::new(), // filled in by `merge_fs_types`
            total_bytes: f[1].parse().unwrap_or(0),
            used_bytes: f[2].parse().unwrap_or(0),
            available_bytes: f[3].parse().unwrap_or(0),
            mount_point: mount,
            inodes_total: 0,
            inodes_used: 0,
        });
    }
    if out.is_empty() {
        return Err(parse_err("df", "no filesystem rows"));
    }
    Ok(out)
}

/// `df -Pi` — inode counts, merged into filesystems already parsed from `df -P`.
pub fn merge_inode_counts(filesystems: &mut [FilesystemInfo], contents: &str) {
    for line in contents.lines().skip(1) {
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        if f.len() < 6 {
            continue;
        }
        let mount = f[5..].join(" ");
        if let Some(fs) = filesystems.iter_mut().find(|x| x.mount_point == mount) {
            fs.inodes_total = f[1].parse().unwrap_or(0);
            fs.inodes_used = f[2].parse().unwrap_or(0);
        }
    }
}

/// `findmnt -rno TARGET,FSTYPE` or `/proc/mounts` — attaches the filesystem
/// type, which `df -P` omits.
pub fn merge_fs_types(filesystems: &mut [FilesystemInfo], mounts: &str) {
    for line in mounts.lines() {
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        // /proc/mounts: device mountpoint fstype options ...
        let (mount, fstype) = if f.len() >= 3 {
            (f[1], f[2])
        } else if f.len() == 2 {
            (f[0], f[1])
        } else {
            continue;
        };
        // /proc/mounts octal-escapes spaces in mount points.
        let mount = mount.replace("\\040", " ");
        if let Some(fs) = filesystems.iter_mut().find(|x| x.mount_point == mount) {
            fs.fs_type = fstype.to_string();
        }
    }
}

/// `ps -eo pid,ppid,user:32,pcpu,pmem,rss,stat,etimes,args --no-headers`.
///
/// `args` is last because it is the only field that can contain spaces.
/// `rss` is in kibibytes. `etimes` is elapsed seconds, which avoids parsing
/// the `[[dd-]hh:]mm:ss` form of `etime`.
pub fn parse_ps(contents: &str) -> Result<Vec<ProcessInfo>> {
    let mut out = Vec::new();
    for line in contents.lines() {
        let line = line.trim_start();
        if line.is_empty() {
            continue;
        }
        let mut it = line.splitn(9, char::is_whitespace).filter(|s| !s.is_empty());
        // splitn with a filter can still yield too few parts on malformed
        // input, so rebuild explicitly with a tolerant field walker.
        let fields: Vec<&str> = {
            let mut v: Vec<&str> = Vec::with_capacity(9);
            let mut rest = line;
            for _ in 0..8 {
                rest = rest.trim_start();
                match rest.find(char::is_whitespace) {
                    Some(i) => {
                        v.push(&rest[..i]);
                        rest = &rest[i..];
                    }
                    None => break,
                }
            }
            v.push(rest.trim_start());
            v
        };
        let _ = it.next();
        if fields.len() < 9 {
            continue;
        }
        let Ok(pid) = fields[0].parse::<u32>() else { continue };
        out.push(ProcessInfo {
            pid,
            ppid: fields[1].parse().unwrap_or(0),
            user: fields[2].to_string(),
            cpu_pct: fields[3].parse().unwrap_or(0.0),
            mem_pct: fields[4].parse().unwrap_or(0.0),
            rss_bytes: fields[5].parse::<u64>().unwrap_or(0) * 1024,
            state: fields[6].to_string(),
            uptime_secs: fields[7].parse().unwrap_or(0),
            command: kyvon_core::redact(fields[8]),
        });
    }
    Ok(out)
}

/// `systemctl list-units --type=service --all --plain --no-legend --no-pager`.
///
/// Columns: UNIT LOAD ACTIVE SUB DESCRIPTION. `--plain` removes the leading
/// status bullet that would otherwise shift every column by one.
pub fn parse_systemctl_units(contents: &str) -> Result<Vec<ServiceInfo>> {
    let mut out = Vec::new();
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        if f.len() < 4 {
            continue;
        }
        // A unit systemd could not find is listed as `● name.service` even
        // with --plain on some versions; drop a leading bullet defensively.
        let start = usize::from(f[0] == "●" || f[0] == "*");
        if f.len() < start + 4 {
            continue;
        }
        out.push(ServiceInfo {
            unit: f[start].to_string(),
            load_state: f[start + 1].to_string(),
            active_state: f[start + 2].to_string(),
            sub_state: f[start + 3].to_string(),
            description: f[start + 4..].join(" "),
            enabled: None,
            active_since_ms: None,
            restarts: None,
        });
    }
    Ok(out)
}

/// `systemctl list-unit-files --type=service --plain --no-legend --no-pager`,
/// merged in to say which units start at boot.
pub fn merge_unit_enablement(services: &mut [ServiceInfo], contents: &str) {
    for line in contents.lines() {
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        if f.len() < 2 {
            continue;
        }
        if let Some(s) = services.iter_mut().find(|s| s.unit == f[0]) {
            s.enabled = Some(f[1].to_string());
        }
    }
}

/// `ss -H -lntup` — listening TCP and UDP sockets with owning processes.
///
/// Row shape: `Netid State Recv-Q Send-Q Local:Port Peer:Port [users:(("name",pid=N,fd=M))]`.
/// The process column is present only when the caller had permission to see
/// it, so an absent process is reported as absent rather than guessed.
pub fn parse_ss(contents: &str) -> Result<Vec<PortInfo>> {
    let mut out = Vec::new();
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split_ascii_whitespace().collect();
        if f.len() < 5 {
            continue;
        }
        let netid = f[0];
        // UDP rows report state `UNCONN`; TCP rows report `LISTEN`.
        let local = f[4];
        let Some((addr, port_str)) = local.rsplit_once(':') else { continue };
        let Ok(port) = port_str.parse::<u16>() else { continue };

        let (process, pid) = parse_ss_users(line);

        out.push(PortInfo {
            port,
            protocol: netid.to_string(),
            address: addr.to_string(),
            exposure: Exposure::from_bind_address(addr),
            process,
            pid,
        });
    }
    Ok(out)
}

/// Pull `("nginx",pid=1234,fd=6)` out of an `ss` row.
fn parse_ss_users(line: &str) -> (Option<String>, Option<u32>) {
    let Some(rest) = line.split_once("users:((").map(|(_, r)| r) else {
        return (None, None);
    };
    let name = rest
        .strip_prefix('"')
        .and_then(|r| r.split_once('"'))
        .map(|(n, _)| n.to_string());
    let pid = rest
        .split_once("pid=")
        .and_then(|(_, r)| r.split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|d| d.parse().ok());
    (name, pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    const DF: &str = "\
Filesystem     1B-blocks        Used   Available Capacity Mounted on
/dev/vda1    52573owned 0 0 0 /bad
/dev/vda1    52573owned
udev          2065846272           0  2065846272       0% /dev
/dev/vda1    52573owned 0
/dev/vda1   105089261568 71234567890 28456789012      72% /
/dev/vda15     109422592     6377472   103045120       6% /boot/efi
tmpfs         2087604224           0  2087604224       0% /run/user/1000
";

    #[test]
    fn reads_df_rows_and_ignores_malformed_ones() {
        let fs = parse_df(DF).unwrap();
        let root = fs.iter().find(|f| f.mount_point == "/").unwrap();
        assert_eq!(root.total_bytes, 105_089_261_568);
        assert_eq!(root.available_bytes, 28_456_789_012);
        assert!(fs.iter().any(|f| f.mount_point == "/boot/efi"));
    }

    #[test]
    fn used_percentage_is_against_usable_space_not_raw_total() {
        // A root filesystem with 5% reserved for root: used + available is
        // less than total, and `df` reports the former.
        let fs = FilesystemInfo {
            mount_point: "/".into(),
            device: "/dev/vda1".into(),
            fs_type: "ext4".into(),
            total_bytes: 100,
            used_bytes: 80,
            available_bytes: 15,
            inodes_total: 0,
            inodes_used: 0,
        };
        // 80 / 95, not 80 / 100.
        assert!((fs.used_pct() - 84.21).abs() < 0.01);
    }

    #[test]
    fn merges_fs_type_and_inodes() {
        let mut fs = parse_df(DF).unwrap();
        merge_fs_types(
            &mut fs,
            "/dev/vda1 / ext4 rw,relatime 0 0\ntmpfs /run/user/1000 tmpfs rw 0 0\n",
        );
        merge_inode_counts(
            &mut fs,
            "Filesystem      Inodes   IUsed    IFree IUse% Mounted on\n/dev/vda1      6553600  412345  6141255    7% /\n",
        );
        let root = fs.iter().find(|f| f.mount_point == "/").unwrap();
        assert_eq!(root.fs_type, "ext4");
        assert_eq!(root.inodes_total, 6_553_600);
        assert!((root.inodes_used_pct().unwrap() - 6.291).abs() < 0.01);
        assert!(root.is_real_storage());
        let run = fs.iter().find(|f| f.mount_point == "/run/user/1000").unwrap();
        assert!(!run.is_real_storage());
    }

    const PS: &str = "\
    1     0 root                              0.0  0.1  12345 Ss    987654 /sbin/init splash
  842     1 www-data                          2.4  1.8 184320 S      54321 nginx: worker process
 1201     1 postgres                         12.7  9.3 987654 Rs     12345 postgres: 13/main: checkpointer
 1500  1201 app                               0.0  0.0      0 Z          5 [defunct]
 1600     1 root                              0.0  0.5  51200 D      99999 /usr/bin/backup --dest /mnt --password hunter2
";

    #[test]
    fn reads_process_table() {
        let p = parse_ps(PS).unwrap();
        assert_eq!(p.len(), 5);
        let pg = p.iter().find(|x| x.pid == 1201).unwrap();
        assert_eq!(pg.user, "postgres");
        assert!((pg.cpu_pct - 12.7).abs() < f32::EPSILON);
        assert_eq!(pg.rss_bytes, 987_654 * 1024);
        assert_eq!(pg.command, "postgres: 13/main: checkpointer");
    }

    #[test]
    fn keeps_commands_with_spaces_intact() {
        let p = parse_ps(PS).unwrap();
        assert_eq!(
            p.iter().find(|x| x.pid == 842).unwrap().command,
            "nginx: worker process"
        );
    }

    #[test]
    fn redacts_secrets_in_command_lines() {
        let p = parse_ps(PS).unwrap();
        let backup = p.iter().find(|x| x.pid == 1600).unwrap();
        assert!(!backup.command.contains("hunter2"), "leaked: {}", backup.command);
        assert!(backup.command.contains("/usr/bin/backup"));
    }

    #[test]
    fn identifies_blocked_and_zombie_states() {
        let p = parse_ps(PS).unwrap();
        assert!(p.iter().find(|x| x.pid == 1600).unwrap().is_blocked());
        assert!(p.iter().find(|x| x.pid == 1500).unwrap().is_zombie());
        assert!(!p.iter().find(|x| x.pid == 842).unwrap().is_blocked());
    }

    const UNITS: &str = "\
nginx.service          loaded active   running A high performance web server
postgresql.service     loaded active   exited  PostgreSQL RDBMS
fail2ban.service       loaded failed   failed  Fail2Ban Service
docker.service         loaded active   running Docker Application Container Engine
some-flaky.service     loaded activating auto-restart Flaky Thing
";

    #[test]
    fn reads_systemd_units() {
        let s = parse_systemctl_units(UNITS).unwrap();
        assert_eq!(s.len(), 5);
        let nginx = s.iter().find(|u| u.unit == "nginx.service").unwrap();
        assert!(nginx.is_running());
        assert_eq!(nginx.description, "A high performance web server");
        assert!(s.iter().find(|u| u.unit == "fail2ban.service").unwrap().is_failed());
        assert!(!s.iter().find(|u| u.unit == "postgresql.service").unwrap().is_running());
        assert!(s
            .iter()
            .find(|u| u.unit == "some-flaky.service")
            .unwrap()
            .is_restart_looping());
    }

    #[test]
    fn merges_boot_enablement() {
        let mut s = parse_systemctl_units(UNITS).unwrap();
        merge_unit_enablement(&mut s, "nginx.service enabled enabled\nfail2ban.service disabled\n");
        assert_eq!(
            s.iter().find(|u| u.unit == "nginx.service").unwrap().enabled.as_deref(),
            Some("enabled")
        );
    }

    const SS: &str = "\
tcp   LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:((\"nginx\",pid=842,fd=6))
tcp   LISTEN 0      4096       127.0.0.1:5432       0.0.0.0:*    users:((\"postgres\",pid=1201,fd=5))
tcp   LISTEN 0      128            0.0.0.0:22       0.0.0.0:*    users:((\"sshd\",pid=901,fd=3))
tcp   LISTEN 0      511             [::]:443           [::]:*    users:((\"nginx\",pid=842,fd=7))
udp   UNCONN 0      0        127.0.0.53%lo:53         0.0.0.0:*
tcp   LISTEN 0      128       192.168.1.10:9100       0.0.0.0:*
";

    #[test]
    fn reads_listening_sockets() {
        let p = parse_ss(SS).unwrap();
        assert_eq!(p.len(), 6);
        let http = p.iter().find(|x| x.port == 80).unwrap();
        assert_eq!(http.process.as_deref(), Some("nginx"));
        assert_eq!(http.pid, Some(842));
        assert_eq!(http.exposure, Exposure::AllInterfaces);
    }

    #[test]
    fn distinguishes_loopback_from_world_reachable() {
        let p = parse_ss(SS).unwrap();
        assert_eq!(
            p.iter().find(|x| x.port == 5432).unwrap().exposure,
            Exposure::Loopback
        );
        assert_eq!(
            p.iter().find(|x| x.port == 22).unwrap().exposure,
            Exposure::AllInterfaces
        );
        assert_eq!(
            p.iter().find(|x| x.port == 9100).unwrap().exposure,
            Exposure::Interface
        );
    }

    #[test]
    fn handles_ipv6_and_missing_process_information() {
        let p = parse_ss(SS).unwrap();
        let tls = p.iter().find(|x| x.port == 443).unwrap();
        assert_eq!(tls.exposure, Exposure::AllInterfaces);
        // A row with no `users:` section must report no process, not a guess.
        let metrics = p.iter().find(|x| x.port == 9100).unwrap();
        assert_eq!(metrics.process, None);
        assert_eq!(metrics.pid, None);
    }
}
