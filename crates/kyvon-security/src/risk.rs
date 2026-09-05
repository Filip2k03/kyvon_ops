//! Command risk classification (specification §36).
//!
//! The classifier parses a command line into segments and words the way a
//! POSIX shell would, then reasons about each segment's program and arguments.
//! It is intentionally conservative in three ways:
//!
//! * An unrecognised program is **not** assumed harmless. It is reported as an
//!   unknown construct and floors the assessment at `Medium`.
//! * Constructs that defeat static reading — command substitution, `eval`,
//!   piping a download into a shell — escalate on sight.
//! * The tier of a whole command line is the tier of its worst segment.
//!
//! The tier never authorises anything. It decides how much the operator is
//! shown and how deliberate the confirmation has to be; execution always waits
//! for that confirmation.

use kyvon_core::{RiskAssessment, RiskTier};

use crate::path::is_protected_from_deletion;

/// Classify a command line the operator is about to run on a remote host.
pub fn classify(command: &str) -> RiskAssessment {
    let command = command.trim();
    let parsed = parse(command);

    let mut tier = RiskTier::Safe;
    let mut reasons: Vec<String> = Vec::new();
    let mut impact: Vec<String> = Vec::new();
    let mut unknown: Vec<String> = Vec::new();

    if command.is_empty() {
        return RiskAssessment {
            tier: RiskTier::Safe,
            command: String::new(),
            reasons: vec!["empty command".into()],
            expected_impact: vec![],
            unknown_constructs: vec![],
        };
    }

    for construct in &parsed.opaque_constructs {
        unknown.push(construct.clone());
        tier = tier.max(RiskTier::Medium);
        reasons.push(format!(
            "contains {construct}, whose effect cannot be determined without running it"
        ));
    }

    // A downloader feeding a shell executes code nobody has read.
    if parsed.pipes_download_into_shell() {
        tier = RiskTier::Critical;
        reasons.push("pipes downloaded content directly into a shell interpreter".into());
        impact.push("runs unreviewed remote code with this user's privileges".into());
    }

    for seg in &parsed.segments {
        let verdict = classify_segment(seg);
        tier = tier.max(verdict.tier);
        reasons.extend(verdict.reasons);
        impact.extend(verdict.impact);
        unknown.extend(verdict.unknown);
    }

    // Writing over a device node or a system file via redirection bypasses the
    // program table entirely.
    for target in &parsed.write_redirect_targets {
        if target == "/dev/null" {
            continue;
        }
        if target.starts_with("/dev/") {
            tier = RiskTier::Critical;
            reasons.push(format!("writes directly to the device node {target}"));
            impact.push("can destroy a block device and its filesystem".into());
        } else if is_protected_from_deletion(target) {
            tier = tier.max(RiskTier::High);
            reasons.push(format!("overwrites {target}, a system-managed path"));
        }
    }

    if reasons.is_empty() {
        reasons.push("reads system state without modifying it".into());
    }
    dedup(&mut reasons);
    dedup(&mut impact);
    dedup(&mut unknown);

    RiskAssessment {
        tier,
        command: command.to_string(),
        reasons,
        expected_impact: impact,
        unknown_constructs: unknown,
    }
}

fn dedup(v: &mut Vec<String>) {
    let mut seen = std::collections::BTreeSet::new();
    v.retain(|item| seen.insert(item.clone()));
}

// ------------------------------------------------------------- parsing

#[derive(Debug, Default)]
struct Parsed {
    segments: Vec<Segment>,
    /// Constructs that make static analysis unsound, e.g. `$(...)`, `eval`.
    opaque_constructs: Vec<String>,
    /// Paths named by `>` or `>>`.
    write_redirect_targets: Vec<String>,
}

#[derive(Debug, Default, Clone)]
struct Segment {
    /// Words with quoting removed, env assignments and privilege wrappers
    /// stripped from the front.
    words: Vec<String>,
    /// `sudo`, `doas`, or empty.
    elevated_via: Option<String>,
    /// True when this segment reads the previous segment's stdout.
    reads_pipe: bool,
}

impl Segment {
    fn program(&self) -> Option<&str> {
        self.words
            .first()
            .map(|w| w.rsplit('/').next().unwrap_or(w.as_str()))
    }

    fn args(&self) -> &[String] {
        self.words.get(1..).unwrap_or(&[])
    }

    fn has_flag(&self, flag: &str) -> bool {
        self.args().iter().any(|a| a == flag)
    }

    /// True for a short flag bundled with others, e.g. `f` in `-rf`.
    fn has_short_flag(&self, ch: char) -> bool {
        self.args().iter().any(|a| {
            a.starts_with('-') && !a.starts_with("--") && a[1..].chars().any(|c| c == ch)
        })
    }

    /// First argument that is not a flag — usually the subcommand.
    fn subcommand(&self) -> Option<&str> {
        self.args()
            .iter()
            .find(|a| !a.starts_with('-'))
            .map(|s| s.as_str())
    }

    /// Non-flag arguments after the subcommand: the operands.
    fn operands(&self) -> Vec<&str> {
        self.args()
            .iter()
            .filter(|a| !a.starts_with('-'))
            .skip(1)
            .map(|s| s.as_str())
            .collect()
    }
}

impl Parsed {
    fn pipes_download_into_shell(&self) -> bool {
        const DOWNLOADERS: &[&str] = &["curl", "wget", "fetch"];
        const SHELLS: &[&str] = &["sh", "bash", "zsh", "dash", "ksh", "python", "python3", "perl", "ruby"];
        for pair in self.segments.windows(2) {
            let (a, b) = (&pair[0], &pair[1]);
            if !b.reads_pipe {
                continue;
            }
            let downloads = a.program().is_some_and(|p| DOWNLOADERS.contains(&p));
            let executes = b.program().is_some_and(|p| SHELLS.contains(&p));
            if downloads && executes {
                return true;
            }
        }
        false
    }
}

/// Split a command line into segments the way a shell would, tracking quoting.
fn parse(input: &str) -> Parsed {
    let mut parsed = Parsed::default();
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut has_current = false;
    let mut reads_pipe = false;
    // Pending redirection operator waiting for its target word.
    let mut pending_redirect: Option<()> = None;

    let bytes: Vec<char> = input.chars().collect();
    let mut i = 0usize;

    let push_word = |current: &mut String,
                         has_current: &mut bool,
                         words: &mut Vec<String>,
                         parsed: &mut Parsed,
                         pending_redirect: &mut Option<()>| {
        if *has_current {
            if pending_redirect.take().is_some() {
                parsed.write_redirect_targets.push(current.clone());
            } else {
                words.push(current.clone());
            }
            current.clear();
            *has_current = false;
        }
    };

    let end_segment = |words: &mut Vec<String>, parsed: &mut Parsed, reads_pipe: &mut bool, next_reads_pipe: bool| {
        if !words.is_empty() {
            parsed.segments.push(build_segment(std::mem::take(words), *reads_pipe));
        }
        *reads_pipe = next_reads_pipe;
    };

    while i < bytes.len() {
        let c = bytes[i];
        match c {
            '\'' => {
                has_current = true;
                i += 1;
                while i < bytes.len() && bytes[i] != '\'' {
                    current.push(bytes[i]);
                    i += 1;
                }
                i += 1;
            }
            '"' => {
                has_current = true;
                i += 1;
                while i < bytes.len() && bytes[i] != '"' {
                    if bytes[i] == '\\' && i + 1 < bytes.len() {
                        i += 1;
                    }
                    // Substitution inside double quotes is still substitution.
                    if bytes[i] == '$' && bytes.get(i + 1) == Some(&'(') {
                        parsed
                            .opaque_constructs
                            .push("a command substitution `$(...)`".into());
                    }
                    current.push(bytes[i]);
                    i += 1;
                }
                i += 1;
            }
            '\\' if i + 1 < bytes.len() => {
                has_current = true;
                current.push(bytes[i + 1]);
                i += 2;
            }
            '$' if bytes.get(i + 1) == Some(&'(') => {
                parsed
                    .opaque_constructs
                    .push("a command substitution `$(...)`".into());
                // Consume to the matching paren so its contents are not read
                // as ordinary words.
                let mut depth = 0;
                while i < bytes.len() {
                    if bytes[i] == '(' {
                        depth += 1;
                    } else if bytes[i] == ')' {
                        depth -= 1;
                        if depth == 0 {
                            i += 1;
                            break;
                        }
                    }
                    i += 1;
                }
                has_current = true;
                current.push_str("$(…)");
            }
            '`' => {
                parsed
                    .opaque_constructs
                    .push("a command substitution `` `...` ``".into());
                i += 1;
                while i < bytes.len() && bytes[i] != '`' {
                    i += 1;
                }
                i += 1;
                has_current = true;
                current.push_str("`…`");
            }
            ' ' | '\t' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                i += 1;
            }
            '|' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                let double = bytes.get(i + 1) == Some(&'|');
                end_segment(&mut words, &mut parsed, &mut reads_pipe, !double);
                i += if double { 2 } else { 1 };
            }
            ';' | '\n' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                end_segment(&mut words, &mut parsed, &mut reads_pipe, false);
                i += 1;
            }
            '&' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                end_segment(&mut words, &mut parsed, &mut reads_pipe, false);
                i += if bytes.get(i + 1) == Some(&'&') { 2 } else { 1 };
            }
            '>' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                pending_redirect = Some(());
                i += if bytes.get(i + 1) == Some(&'>') { 2 } else { 1 };
            }
            '<' => {
                push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
                i += 1;
            }
            _ => {
                has_current = true;
                current.push(c);
                i += 1;
            }
        }
    }
    push_word(&mut current, &mut has_current, &mut words, &mut parsed, &mut pending_redirect);
    end_segment(&mut words, &mut parsed, &mut reads_pipe, false);

    parsed
}

/// Strip leading `VAR=value` assignments and privilege wrappers.
fn build_segment(raw: Vec<String>, reads_pipe: bool) -> Segment {
    let mut words = raw;
    let mut elevated_via = None;

    loop {
        let Some(first) = words.first().cloned() else { break };
        // `VAR=value cmd ...`
        if let Some(eq) = first.find('=') {
            if eq > 0
                && first[..eq]
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_')
            {
                words.remove(0);
                continue;
            }
        }
        let base = first.rsplit('/').next().unwrap_or(&first).to_string();
        match base.as_str() {
            "sudo" | "doas" => {
                elevated_via = Some(base);
                words.remove(0);
                // Drop sudo's own options, including `-u user`.
                while let Some(w) = words.first() {
                    if w == "-u" || w == "--user" {
                        words.drain(..2.min(words.len()));
                    } else if w.starts_with('-') {
                        words.remove(0);
                    } else {
                        break;
                    }
                }
            }
            "nohup" | "command" | "exec" | "time" | "nice" | "ionice" | "stdbuf" | "setsid" => {
                words.remove(0);
                while words.first().is_some_and(|w| w.starts_with('-')) {
                    words.remove(0);
                }
            }
            "env" => {
                words.remove(0);
                while words.first().is_some_and(|w| w.contains('=') || w.starts_with('-')) {
                    words.remove(0);
                }
            }
            _ => break,
        }
    }

    Segment {
        words,
        elevated_via,
        reads_pipe,
    }
}

// -------------------------------------------------------- classification

struct Verdict {
    tier: RiskTier,
    reasons: Vec<String>,
    impact: Vec<String>,
    unknown: Vec<String>,
}

impl Default for Verdict {
    /// Starts at `Safe`. Arms of [`classify_segment`] that describe a purely
    /// read-only program leave the tier untouched; every arm that can change
    /// remote state assigns one explicitly, and an unrecognised program falls
    /// through to the `Medium` catch-all rather than to this default.
    fn default() -> Self {
        Self {
            tier: RiskTier::Safe,
            reasons: Vec::new(),
            impact: Vec::new(),
            unknown: Vec::new(),
        }
    }
}

/// Programs that only read state.
const READ_ONLY: &[&str] = &[
    "cat", "head", "tail", "less", "more", "ls", "stat", "file", "du", "df", "free", "uptime",
    "uname", "hostname", "hostnamectl", "id", "whoami", "who", "w", "last", "lastlog", "ps",
    "pgrep", "top", "htop", "vmstat", "iostat", "mpstat", "pidstat", "lsof", "ss", "netstat",
    "arp", "dig", "nslookup", "host", "ping", "traceroute", "mtr", "getent", "lscpu", "lsblk",
    "lsmod", "lspci", "lsusb", "dmesg", "journalctl", "date", "wc", "grep", "egrep", "fgrep",
    "awk", "cut", "sort", "uniq", "tr", "tee", "xargs", "echo", "printf", "basename", "dirname",
    "readlink", "realpath", "sha256sum", "md5sum", "nproc", "findmnt", "blkid", "mount",
    "sysctl", "ip", "true", "false", "test", "sleep", "env", "printenv", "which", "type",
];

fn classify_segment(seg: &Segment) -> Verdict {
    let mut v = Verdict::default();

    let Some(program) = seg.program() else {
        return v;
    };

    if let Some(via) = &seg.elevated_via {
        v.reasons
            .push(format!("runs `{program}` with elevated privileges via {via}"));
    }

    match program {
        // ------------------------------------------------ destructive
        "rm" => {
            let recursive = seg.has_short_flag('r') || seg.has_short_flag('R') || seg.has_flag("--recursive");
            let forced = seg.has_short_flag('f') || seg.has_flag("--force");
            let targets: Vec<&str> = seg
                .args()
                .iter()
                .filter(|a| !a.starts_with('-'))
                .map(|s| s.as_str())
                .collect();
            let hits_protected = targets.iter().any(|t| is_protected_from_deletion(t));
            let wildcard = targets.iter().any(|t| t.contains('*') || t.contains('?'));

            v.tier = if hits_protected || (recursive && forced) {
                RiskTier::Critical
            } else if recursive || forced {
                RiskTier::High
            } else {
                RiskTier::Medium
            };
            if forced {
                v.reasons
                    .push("`-f` suppresses the prompts that would otherwise stop a mistaken path".into());
            }
            v.reasons.push(if recursive {
                "deletes files recursively".into()
            } else {
                "deletes files".into()
            });
            if hits_protected {
                v.reasons
                    .push("targets a system-managed path that the host needs to function".into());
                v.impact.push("can render the host unbootable or unreachable".into());
            }
            if wildcard {
                v.reasons.push(
                    "expands a wildcard on the remote host, so the exact set of files cannot be shown here".into(),
                );
            }
            v.impact.push("deleted files are not recoverable from KyvonOPS".into());
        }
        "shred" | "wipefs" => {
            v.tier = RiskTier::Critical;
            v.reasons.push(format!("`{program}` irreversibly destroys data"));
            v.impact.push("data cannot be recovered".into());
        }
        "dd" => {
            let writes_device = seg
                .args()
                .iter()
                .any(|a| a.starts_with("of=/dev/") && a != "of=/dev/null");
            v.tier = if writes_device { RiskTier::Critical } else { RiskTier::High };
            v.reasons.push("writes raw blocks".into());
            if writes_device {
                v.impact.push("overwrites a block device and every filesystem on it".into());
            }
        }
        p if p.starts_with("mkfs") => {
            v.tier = RiskTier::Critical;
            v.reasons.push("creates a new filesystem, discarding the existing one".into());
            v.impact.push("all data on the target device is lost".into());
        }
        "reboot" | "shutdown" | "poweroff" | "halt" | "init" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("changes the running state of the whole machine".into());
            v.impact
                .push("the host and every service on it go offline; SSH access is lost until it returns".into());
        }

        // ---------------------------------------------------- systemd
        "systemctl" => classify_systemctl(seg, &mut v),
        "service" => {
            let action = seg.operands().first().copied().unwrap_or("");
            match action {
                "status" => v.tier = RiskTier::Safe,
                "restart" | "stop" | "start" | "reload" => {
                    v.tier = RiskTier::Medium;
                    v.reasons.push(format!("{action}s a system service"));
                    v.impact.push("requests in flight may fail while the service is unavailable".into());
                }
                _ => {
                    v.tier = RiskTier::Medium;
                    v.unknown.push(format!("`service {action}`"));
                }
            }
        }
        "journalctl" => {
            // `--vacuum-*` deletes journal history.
            if seg.args().iter().any(|a| a.starts_with("--vacuum")) {
                v.tier = RiskTier::High;
                v.reasons.push("permanently discards journal history".into());
                v.impact.push("past log evidence for incidents is lost".into());
            }
        }

        // ------------------------------------------------- processes
        "kill" | "pkill" | "killall" => {
            let sigkill = seg.has_flag("-9") || seg.has_flag("-KILL") || seg.has_flag("-SIGKILL");
            v.tier = if sigkill { RiskTier::High } else { RiskTier::Medium };
            v.reasons.push(if sigkill {
                "terminates a process immediately with SIGKILL, giving it no chance to shut down cleanly".into()
            } else {
                "signals a running process to terminate".into()
            });
            if sigkill {
                v.impact.push("in-flight work and unflushed data are lost".into());
            }
            if program != "kill" {
                v.reasons.push("matches processes by name, so it may signal more than one".into());
            }
        }

        // -------------------------------------------------- packages
        "apt" | "apt-get" | "dnf" | "yum" | "zypper" | "apk" | "pacman" => {
            classify_package_manager(program, seg, &mut v)
        }

        // -------------------------------------------------- firewall
        "ufw" => classify_ufw(seg, &mut v),
        "iptables" | "ip6tables" | "nft" | "firewall-cmd" => {
            let flushes = seg.has_flag("-F") || seg.has_flag("--flush") || seg.has_flag("flush");
            let lists = seg.has_flag("-L") || seg.has_flag("--list") || seg.has_flag("list")
                || seg.has_flag("-S") || seg.has_flag("--list-all");
            if flushes {
                v.tier = RiskTier::Critical;
                v.reasons.push("removes every firewall rule at once".into());
                v.impact.push(
                    "the host may become fully exposed, or unreachable if the default policy is DROP".into(),
                );
            } else if lists {
                v.tier = RiskTier::Safe;
            } else {
                v.tier = RiskTier::High;
                v.reasons.push("changes packet filtering rules".into());
                v.impact.push("a mistake here can lock out SSH; you would need console access".into());
            }
        }

        // ------------------------------------------------------ ssh
        "sshd" | "ssh-keygen" => {
            v.tier = RiskTier::High;
            v.reasons.push("changes SSH host or key configuration".into());
            v.impact.push("can prevent future SSH logins".into());
        }

        // ---------------------------------------------------- users
        "useradd" | "usermod" | "groupadd" | "groupmod" | "passwd" | "chpasswd" | "adduser" => {
            v.tier = RiskTier::High;
            v.reasons.push("changes system accounts or credentials".into());
            v.impact.push("affects who can log in and with what privileges".into());
        }
        "userdel" | "groupdel" | "deluser" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("removes a system account".into());
            v.impact.push("processes owned by the account and its home directory may be lost".into());
        }
        "visudo" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("edits sudo authorisation".into());
            v.impact.push("a syntax error here can remove all privilege escalation on the host".into());
        }

        // ------------------------------------------------ permissions
        "chmod" | "chown" | "chgrp" | "setfacl" => {
            let recursive = seg.has_short_flag('R') || seg.has_flag("--recursive");
            let world_writable = seg.args().iter().any(|a| a.ends_with("777") || a.ends_with("666"));
            let targets: Vec<&str> = seg.args().iter().filter(|a| !a.starts_with('-')).map(|s| s.as_str()).collect();
            let protected = targets.iter().any(|t| is_protected_from_deletion(t));
            v.tier = if protected || (recursive && world_writable) {
                RiskTier::Critical
            } else {
                RiskTier::High
            };
            v.reasons.push("changes file ownership or permissions".into());
            if world_writable {
                v.reasons.push("grants write access to every user on the host".into());
            }
            if protected {
                v.impact.push("altering permissions on system paths can break login or boot".into());
            }
        }

        // -------------------------------------------------- docker
        "docker" | "podman" => classify_docker(seg, &mut v),

        // ------------------------------------------------- editors
        "sed" => {
            if seg.has_short_flag('i') || seg.args().iter().any(|a| a.starts_with("--in-place")) {
                v.tier = RiskTier::High;
                v.reasons.push("edits files in place".into());
                v.impact.push("the original content is replaced without a backup unless one was requested".into());
            }
        }
        "truncate" => {
            v.tier = RiskTier::Medium;
            v.reasons.push("changes a file's length, discarding content beyond it".into());
        }
        "tee" if !seg.args().is_empty() => {
            v.tier = RiskTier::Medium;
            v.reasons.push("writes its input to a file".into());
        }
        "mv" | "cp" | "ln" | "mkdir" | "touch" => {
            let targets: Vec<&str> = seg.args().iter().filter(|a| !a.starts_with('-')).map(|s| s.as_str()).collect();
            let protected = targets.iter().any(|t| is_protected_from_deletion(t));
            v.tier = if protected { RiskTier::High } else { RiskTier::Low };
            v.reasons.push("creates or moves files".into());
            if protected {
                v.reasons.push("one of the targets is a system-managed path".into());
            }
        }
        "eval" | "source" | "." => {
            v.tier = RiskTier::High;
            v.reasons.push("executes text as code, so its effect cannot be read from the command".into());
            v.unknown.push(format!("`{program}`"));
        }
        "crontab" | "at" => {
            v.tier = RiskTier::High;
            v.reasons.push("schedules commands to run later, outside this session".into());
        }
        "nginx" | "apache2ctl" | "apachectl" | "httpd" => {
            if seg.has_flag("-t") || seg.has_flag("configtest") {
                v.tier = RiskTier::Safe;
                v.reasons.push("validates configuration without applying it".into());
            } else if seg.has_flag("-s") || seg.subcommand().is_some_and(|s| s.contains("restart") || s.contains("reload")) {
                v.tier = RiskTier::Medium;
                v.reasons.push("signals the web server to reload or restart".into());
                v.impact.push("connections may be reset during the reload".into());
            } else {
                v.tier = RiskTier::Medium;
                v.unknown.push(format!("`{program}` invocation"));
            }
        }
        "git" => {
            let sub = seg.subcommand().unwrap_or("");
            v.tier = match sub {
                "status" | "log" | "diff" | "show" | "branch" | "remote" | "rev-parse" => RiskTier::Safe,
                "pull" | "fetch" | "checkout" | "switch" => RiskTier::Medium,
                "reset" | "clean" | "push" => RiskTier::High,
                _ => RiskTier::Low,
            };
            if v.tier >= RiskTier::Medium {
                v.reasons.push(format!("`git {sub}` changes the working tree or a remote"));
            }
            if sub == "reset" || sub == "clean" {
                v.impact.push("uncommitted local changes on the server are discarded".into());
            }
        }

        // ----------------------------------------------- read-only
        p if READ_ONLY.contains(&p) => {
            v.tier = RiskTier::Safe;
        }

        // ------------------------------------------------- unknown
        other => {
            v.tier = RiskTier::Medium;
            v.unknown.push(format!("`{other}`, which KyvonOPS does not recognise"));
            v.reasons.push(format!(
                "`{other}` is not in the classifier's table, so its effect is treated as unknown rather than assumed safe"
            ));
        }
    }

    v
}

fn classify_systemctl(seg: &Segment, v: &mut Verdict) {
    let sub = seg.subcommand().unwrap_or("");
    let units = seg.operands();
    let unit_list = if units.is_empty() {
        "the unit".to_string()
    } else {
        units.join(", ")
    };

    match sub {
        "" | "status" | "show" | "cat" | "list-units" | "list-unit-files" | "list-timers"
        | "is-active" | "is-enabled" | "is-failed" | "get-default" => {
            v.tier = RiskTier::Safe;
        }
        "start" => {
            v.tier = RiskTier::Medium;
            v.reasons.push(format!("starts {unit_list}"));
        }
        "reload" => {
            v.tier = RiskTier::Medium;
            v.reasons.push(format!("reloads configuration for {unit_list}"));
            v.impact.push("a configuration error can leave the service in a failed state".into());
        }
        "restart" | "try-restart" | "reload-or-restart" => {
            v.tier = RiskTier::Medium;
            v.reasons.push(format!("restarts {unit_list}"));
            v.impact.push("brief service interruption; in-flight requests may fail".into());
        }
        "stop" => {
            v.tier = RiskTier::High;
            v.reasons.push(format!("stops {unit_list} and leaves it stopped"));
            v.impact.push("the service stays down until it is started again".into());
        }
        "enable" | "disable" | "mask" | "unmask" | "preset" | "set-default" => {
            v.tier = RiskTier::High;
            v.reasons.push(format!("changes whether {unit_list} starts at boot"));
            v.impact.push("the effect is only fully visible after the next reboot".into());
        }
        "daemon-reload" => {
            v.tier = RiskTier::Low;
            v.reasons.push("reloads systemd's own unit definitions".into());
        }
        "kill" => {
            v.tier = RiskTier::High;
            v.reasons.push(format!("sends a signal directly to {unit_list}"));
        }
        "isolate" | "rescue" | "emergency" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("switches the machine to a different systemd target".into());
            v.impact.push("most services, possibly including sshd, are stopped".into());
        }
        "reboot" | "poweroff" | "halt" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("shuts down or restarts the machine".into());
            v.impact.push("the host goes offline; SSH access is lost until it returns".into());
        }
        other => {
            v.tier = RiskTier::Medium;
            v.unknown.push(format!("`systemctl {other}`"));
        }
    }

    // Restarting sshd over SSH is a specific, recoverable-but-alarming case
    // worth calling out explicitly.
    if units.iter().any(|u| u.starts_with("ssh")) && matches!(sub, "restart" | "stop" | "disable" | "mask") {
        v.tier = v.tier.max(RiskTier::Critical);
        v.reasons.push("targets the SSH service that KyvonOPS itself connects through".into());
        v.impact.push(
            "if the new configuration is invalid you will not be able to reconnect without console access".into(),
        );
    }
}

fn classify_package_manager(program: &str, seg: &Segment, v: &mut Verdict) {
    let sub = seg.subcommand().unwrap_or("");
    match sub {
        "list" | "search" | "show" | "info" | "policy" | "list-updates" | "check-update" | "-Q"
        | "-Ss" | "-Si" => v.tier = RiskTier::Safe,
        "update" if program == "apt" || program == "apt-get" => {
            // On apt, `update` only refreshes indexes.
            v.tier = RiskTier::Low;
            v.reasons.push("refreshes the package index without changing installed packages".into());
        }
        "install" | "add" | "-S" => {
            v.tier = RiskTier::High;
            v.reasons.push("installs packages, which may pull in dependencies and restart services".into());
            v.impact.push("post-install scripts can restart running services".into());
        }
        "upgrade" | "dist-upgrade" | "full-upgrade" | "update" | "-Syu" => {
            v.tier = RiskTier::High;
            v.reasons.push("upgrades installed packages".into());
            v.impact.push("services are restarted as their packages are replaced".into());
            v.impact.push("a kernel upgrade takes effect only after a reboot".into());
        }
        "remove" | "purge" | "erase" | "del" | "-R" | "-Rs" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("removes installed packages".into());
            v.impact.push("dependency resolution may remove more than the named package".into());
        }
        "autoremove" | "autoclean" | "clean" => {
            v.tier = RiskTier::Medium;
            v.reasons.push("removes cached or orphaned packages".into());
        }
        other => {
            v.tier = RiskTier::High;
            v.unknown.push(format!("`{program} {other}`"));
        }
    }
}

fn classify_ufw(seg: &Segment, v: &mut Verdict) {
    match seg.subcommand().unwrap_or("") {
        "status" | "show" | "version" => v.tier = RiskTier::Safe,
        "disable" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("disables the host firewall entirely".into());
            v.impact.push("every listening port becomes reachable from anywhere the network allows".into());
        }
        "reset" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("deletes all firewall rules and returns ufw to its defaults".into());
            v.impact.push("existing SSH access may be dropped by the default policy".into());
        }
        "enable" | "allow" | "deny" | "reject" | "delete" | "limit" | "default" => {
            v.tier = RiskTier::High;
            v.reasons.push("changes firewall rules".into());
            v.impact.push("a mistake can lock out SSH; you would need console access to recover".into());
        }
        other => {
            v.tier = RiskTier::High;
            v.unknown.push(format!("`ufw {other}`"));
        }
    }
}

fn classify_docker(seg: &Segment, v: &mut Verdict) {
    let sub = seg.subcommand().unwrap_or("");
    match sub {
        "ps" | "images" | "logs" | "inspect" | "stats" | "version" | "info" | "top" | "port"
        | "diff" | "history" | "events" => v.tier = RiskTier::Safe,
        "start" => {
            v.tier = RiskTier::Low;
            v.reasons.push("starts a container".into());
        }
        "restart" | "stop" | "pause" | "unpause" | "kill" => {
            v.tier = RiskTier::Medium;
            v.reasons.push(format!("{sub}s a running container"));
            v.impact.push("traffic served by the container fails until it is running again".into());
        }
        "rm" | "rmi" => {
            v.tier = RiskTier::High;
            v.reasons.push("removes containers or images".into());
            v.impact.push("anonymous volumes attached to a removed container may be lost".into());
        }
        "prune" | "system" => {
            v.tier = RiskTier::Critical;
            v.reasons.push("bulk-deletes unused Docker objects".into());
            v.impact.push("stopped containers, unused images and dangling volumes are deleted".into());
        }
        "exec" | "run" => {
            v.tier = RiskTier::High;
            v.reasons.push("executes a command inside a container".into());
            v.unknown.push("the command run inside the container".into());
        }
        "volume" => {
            let op = seg.operands().first().copied().unwrap_or("");
            v.tier = if matches!(op, "ls" | "inspect") { RiskTier::Safe } else { RiskTier::Critical };
            if v.tier == RiskTier::Critical {
                v.reasons.push("changes Docker volumes, which hold persistent data".into());
            }
        }
        "compose" => {
            let op = seg.operands().first().copied().unwrap_or("");
            v.tier = match op {
                "ps" | "logs" | "config" => RiskTier::Safe,
                "up" | "restart" => RiskTier::Medium,
                "down" => RiskTier::High,
                _ => RiskTier::Medium,
            };
            if op == "down" {
                v.reasons.push("stops and removes the whole compose stack".into());
            }
        }
        other => {
            v.tier = RiskTier::Medium;
            v.unknown.push(format!("`docker {other}`"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tier(cmd: &str) -> RiskTier {
        classify(cmd).tier
    }

    #[test]
    fn specification_examples() {
        // The four examples given in specification §36.
        assert_eq!(tier("systemctl status nginx"), RiskTier::Safe);
        assert_eq!(tier("systemctl restart nginx"), RiskTier::Medium);
        assert_eq!(tier("apt upgrade"), RiskTier::High);
        assert_eq!(tier("rm -rf /var/lib/mysql"), RiskTier::Critical);
    }

    #[test]
    fn reads_are_safe() {
        for cmd in [
            "cat /etc/os-release",
            "ps aux",
            "df -h",
            "journalctl -u nginx -n 100",
            "ss -lntup",
            "docker ps -a",
            "systemctl list-units --failed",
        ] {
            assert_eq!(tier(cmd), RiskTier::Safe, "expected {cmd} to be safe");
        }
    }

    #[test]
    fn restarting_sshd_is_critical_because_it_is_our_own_transport() {
        let a = classify("systemctl restart sshd");
        assert_eq!(a.tier, RiskTier::Critical);
        assert!(a
            .reasons
            .iter()
            .any(|r| r.contains("KyvonOPS itself connects through")));
    }

    #[test]
    fn curl_piped_into_shell_is_critical() {
        let a = classify("curl -fsSL https://example.com/install.sh | sh");
        assert_eq!(a.tier, RiskTier::Critical);
        assert!(a.reasons.iter().any(|r| r.contains("pipes downloaded content")));
    }

    #[test]
    fn curl_alone_is_not_escalated() {
        // Fetching a URL is not the dangerous half; executing it is.
        assert!(tier("curl -fsSL https://example.com/health") < RiskTier::Critical);
    }

    #[test]
    fn unknown_programs_are_not_assumed_safe() {
        let a = classify("/opt/vendor/bin/rollout --now");
        assert_eq!(a.tier, RiskTier::Medium);
        assert!(!a.unknown_constructs.is_empty());
    }

    #[test]
    fn command_substitution_is_flagged() {
        let a = classify("rm -rf $(cat /tmp/targets)");
        assert!(a.tier >= RiskTier::High);
        assert!(a
            .unknown_constructs
            .iter()
            .any(|u| u.contains("command substitution")));
    }

    #[test]
    fn worst_segment_wins_across_a_chain() {
        assert_eq!(
            tier("systemctl status nginx && rm -rf /etc/nginx"),
            RiskTier::Critical
        );
    }

    #[test]
    fn quoted_metacharacters_are_not_separate_commands() {
        // The `;` is inside quotes: this greps for a literal string, it does
        // not run `rm`.
        let a = classify("grep 'a; rm -rf /' /var/log/syslog");
        assert_eq!(a.tier, RiskTier::Safe);
    }

    #[test]
    fn sudo_wrapper_is_seen_through() {
        assert_eq!(tier("sudo systemctl restart nginx"), RiskTier::Medium);
        assert_eq!(tier("sudo -u postgres psql -c 'select 1'"), RiskTier::Medium);
        let a = classify("sudo systemctl restart nginx");
        assert!(a.reasons.iter().any(|r| r.contains("elevated privileges")));
    }

    #[test]
    fn env_assignments_do_not_hide_the_program() {
        assert_eq!(
            tier("DEBIAN_FRONTEND=noninteractive apt-get remove -y nginx"),
            RiskTier::Critical
        );
    }

    #[test]
    fn redirect_to_device_is_critical() {
        assert_eq!(tier("echo x > /dev/sda"), RiskTier::Critical);
        // /dev/null is the ordinary way to discard output.
        assert_eq!(tier("echo x > /dev/null"), RiskTier::Safe);
    }

    #[test]
    fn firewall_flush_is_critical() {
        assert_eq!(tier("iptables -F"), RiskTier::Critical);
        assert_eq!(tier("ufw disable"), RiskTier::Critical);
        assert_eq!(tier("ufw status"), RiskTier::Safe);
    }

    #[test]
    fn every_assessment_explains_itself() {
        for cmd in [
            "systemctl restart nginx",
            "rm -rf /var/tmp/cache",
            "apt install nginx",
            "docker prune",
        ] {
            let a = classify(cmd);
            assert!(!a.reasons.is_empty(), "{cmd} produced no reasons");
            if a.tier >= RiskTier::Medium {
                assert!(!a.expected_impact.is_empty(), "{cmd} produced no impact");
            }
        }
    }

    #[test]
    fn empty_command_is_inert() {
        assert_eq!(tier(""), RiskTier::Safe);
        assert_eq!(tier("   "), RiskTier::Safe);
    }
}
