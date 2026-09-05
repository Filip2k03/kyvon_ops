use kyvon_core::{KyvonError, Result};

/// Quote `s` so a POSIX shell reads it as exactly one word with no expansion.
///
/// Single quotes suppress every form of substitution, so the only character
/// needing care is the single quote itself, which is closed, escaped and
/// reopened. The empty string still needs quoting or it disappears entirely.
pub fn quote(s: &str) -> String {
    if !s.is_empty()
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.' | b'/' | b':' | b'@' | b','))
    {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        if c == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(c);
        }
    }
    out.push('\'');
    out
}

/// A remote command assembled from a fixed program and quoted arguments.
///
/// This is the only sanctioned way to build a command that includes operator
/// input. There is no constructor taking a whole command line, because that is
/// precisely the shape that lets an injected `; rm -rf /` through.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cmd {
    program: String,
    args: Vec<String>,
    /// Prefix the rendered command with `sudo -n` (non-interactive).
    sudo: bool,
}

impl Cmd {
    /// Start a command. The program name must be a bare executable name or an
    /// absolute path — never operator-supplied text.
    pub fn new(program: &str) -> Result<Self> {
        let valid = !program.is_empty()
            && program.bytes().all(|b| {
                b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.' | b'/')
            })
            && !program.contains("..");
        if !valid {
            return Err(KyvonError::Invalid(format!(
                "`{program}` is not a valid program name"
            )));
        }
        Ok(Self {
            program: program.to_string(),
            args: Vec::new(),
            sudo: false,
        })
    }

    /// Append one argument. Quoting happens at render time.
    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.args.push(a.into());
        self
    }

    pub fn args<I, S>(mut self, items: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.args.extend(items.into_iter().map(Into::into));
        self
    }

    /// Run under `sudo -n`, which fails immediately rather than blocking on a
    /// password prompt that has nowhere to be answered.
    pub fn sudo(mut self) -> Self {
        self.sudo = true;
        self
    }

    /// The exact string that will be sent to the remote shell.
    pub fn render(&self) -> String {
        let mut parts: Vec<String> = Vec::with_capacity(self.args.len() + 3);
        if self.sudo {
            parts.push("sudo".into());
            parts.push("-n".into());
        }
        parts.push(quote(&self.program));
        parts.extend(self.args.iter().map(|a| quote(a)));
        parts.join(" ")
    }

    pub fn program(&self) -> &str {
        &self.program
    }
}

impl std::fmt::Display for Cmd {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.render())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_words_are_left_bare() {
        assert_eq!(quote("nginx.service"), "nginx.service");
        assert_eq!(quote("/var/log/syslog"), "/var/log/syslog");
    }

    #[test]
    fn empty_string_is_still_a_word() {
        assert_eq!(quote(""), "''");
    }

    #[test]
    fn metacharacters_are_neutralised() {
        assert_eq!(quote("a; rm -rf /"), "'a; rm -rf /'");
        assert_eq!(quote("$(whoami)"), "'$(whoami)'");
        assert_eq!(quote("a`id`b"), "'a`id`b'");
        assert_eq!(quote("x && y"), "'x && y'");
    }

    #[test]
    fn embedded_single_quote_cannot_escape() {
        // The classic break-out attempt: close the quote, inject, reopen.
        let quoted = quote("'; rm -rf / #");
        assert_eq!(quoted, r"''\''; rm -rf / #'");
    }

    /// Proves the quoting against a real shell rather than against our own
    /// idea of one: whatever goes in must come back out as exactly one word.
    #[test]
    fn round_trips_through_a_real_shell() {
        use std::process::Command;
        for hostile in [
            "'; rm -rf / #",
            "$(whoami)",
            "`id`",
            "a b\tc",
            "--flag=value with spaces",
            "\"double\" and 'single'",
            "*",
            "",
            "back\\slash",
            "new\nline",
        ] {
            let script = format!("printf '%s' {}", quote(hostile));
            let out = Command::new("/bin/sh")
                .arg("-c")
                .arg(&script)
                .output()
                .expect("spawn /bin/sh");
            assert_eq!(
                String::from_utf8_lossy(&out.stdout),
                hostile,
                "quoting altered the value; script was: {script}"
            );
        }
    }

    #[test]
    fn cmd_rejects_hostile_program_names() {
        assert!(Cmd::new("systemctl").is_ok());
        assert!(Cmd::new("/usr/bin/systemctl").is_ok());
        assert!(Cmd::new("systemctl; rm -rf /").is_err());
        assert!(Cmd::new("../../bin/sh").is_err());
        assert!(Cmd::new("").is_err());
    }

    #[test]
    fn cmd_quotes_every_argument() {
        let c = Cmd::new("systemctl")
            .unwrap()
            .arg("restart")
            .arg("evil; reboot");
        assert_eq!(c.render(), "systemctl restart 'evil; reboot'");
    }

    #[test]
    fn sudo_is_non_interactive() {
        let c = Cmd::new("systemctl").unwrap().arg("restart").arg("nginx").sudo();
        assert_eq!(c.render(), "sudo -n systemctl restart nginx");
    }
}
