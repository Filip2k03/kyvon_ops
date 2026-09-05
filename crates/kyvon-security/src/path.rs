use kyvon_core::{KyvonError, Result};

/// How sensitive a remote path is, which determines the risk tier of any
/// operation naming it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum PathClass {
    /// Ordinary user or application data.
    Ordinary,
    /// System configuration — changing it alters how the host behaves.
    SystemConfig,
    /// Losing or corrupting this can make the host unbootable or unreachable.
    Critical,
}

/// Prefixes whose contents govern access to the machine itself.
const CRITICAL_PREFIXES: &[&str] = &[
    "/boot", "/dev", "/proc", "/sys", "/etc/ssh", "/etc/sudoers", "/etc/shadow", "/etc/passwd",
    "/etc/group", "/etc/fstab", "/root/.ssh",
];

/// Prefixes holding system configuration.
const CONFIG_PREFIXES: &[&str] = &["/etc", "/usr/lib/systemd", "/lib/systemd"];

/// Normalise and validate a remote absolute path.
///
/// Returns the cleaned path. Rejects anything that is not absolute, that still
/// contains a traversal component after normalisation, that embeds a NUL or a
/// newline, or that resolves to `/` itself — operating on the filesystem root
/// is never what the operator meant, and is how a delete becomes a disaster.
///
/// This is not a substitute for the remote system's own permission checks; it
/// exists so KyvonOPS never *sends* an operation whose target it cannot state
/// unambiguously in the confirmation dialog.
pub fn validate_remote_path(path: &str) -> Result<String> {
    if path.is_empty() {
        return Err(KyvonError::Invalid("path must not be empty".into()));
    }
    if path.contains('\0') || path.contains('\n') || path.contains('\r') {
        return Err(KyvonError::Invalid(
            "path must not contain control characters".into(),
        ));
    }
    if !path.starts_with('/') {
        return Err(KyvonError::Invalid(format!(
            "path `{path}` must be absolute so the target shown to you is unambiguous"
        )));
    }

    let mut stack: Vec<&str> = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => continue,
            ".." => {
                if stack.pop().is_none() {
                    return Err(KyvonError::Invalid(format!(
                        "path `{path}` traverses above the filesystem root"
                    )));
                }
            }
            other => stack.push(other),
        }
    }

    if stack.is_empty() {
        return Err(KyvonError::Invalid(
            "`/` is not a valid target for a filesystem operation".into(),
        ));
    }

    Ok(format!("/{}", stack.join("/")))
}

/// Classify a *normalised* path. Call [`validate_remote_path`] first.
pub fn classify_path(path: &str) -> PathClass {
    let p = path.trim_end_matches('/');
    if CRITICAL_PREFIXES
        .iter()
        .any(|c| p == *c || p.starts_with(&format!("{c}/")))
    {
        return PathClass::Critical;
    }
    if CONFIG_PREFIXES
        .iter()
        .any(|c| p == *c || p.starts_with(&format!("{c}/")))
    {
        return PathClass::SystemConfig;
    }
    PathClass::Ordinary
}

/// Whether deleting this path could plausibly break the host.
///
/// Top-level directories are included because removing `/var` or `/usr` is
/// unrecoverable, and because a shell variable that expanded to empty is the
/// usual way an operator arrives at `rm -rf /usr`.
pub fn is_protected_from_deletion(path: &str) -> bool {
    let p = path.trim_end_matches('/');
    if classify_path(p) != PathClass::Ordinary {
        return true;
    }
    matches!(
        p,
        "/bin" | "/sbin" | "/lib" | "/lib64" | "/usr" | "/var" | "/opt" | "/home" | "/srv" | "/run"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_redundant_components() {
        assert_eq!(
            validate_remote_path("/var//log/./nginx/").unwrap(),
            "/var/log/nginx"
        );
    }

    #[test]
    fn resolves_traversal_within_the_tree() {
        assert_eq!(
            validate_remote_path("/var/log/../lib/mysql").unwrap(),
            "/var/lib/mysql"
        );
    }

    #[test]
    fn rejects_traversal_above_root() {
        assert!(validate_remote_path("/../etc/shadow").is_err());
        assert!(validate_remote_path("/var/../../etc").is_err());
    }

    #[test]
    fn rejects_relative_paths() {
        assert!(validate_remote_path("etc/passwd").is_err());
        assert!(validate_remote_path("../secrets").is_err());
    }

    #[test]
    fn rejects_root_itself() {
        assert!(validate_remote_path("/").is_err());
        assert!(validate_remote_path("/../").is_err());
    }

    #[test]
    fn rejects_control_characters() {
        assert!(validate_remote_path("/var/log\nrm -rf /").is_err());
        assert!(validate_remote_path("/var/log\0").is_err());
    }

    #[test]
    fn classifies_sensitive_trees() {
        assert_eq!(classify_path("/etc/ssh/sshd_config"), PathClass::Critical);
        assert_eq!(classify_path("/boot/vmlinuz"), PathClass::Critical);
        assert_eq!(classify_path("/etc/nginx/nginx.conf"), PathClass::SystemConfig);
        assert_eq!(classify_path("/var/www/html/index.html"), PathClass::Ordinary);
    }

    #[test]
    fn protects_top_level_directories_from_deletion() {
        assert!(is_protected_from_deletion("/usr"));
        assert!(is_protected_from_deletion("/var/"));
        assert!(is_protected_from_deletion("/etc/nginx"));
        assert!(!is_protected_from_deletion("/var/www/html/old"));
    }

    // `/etcetera` must not be treated as living under `/etc`.
    #[test]
    fn prefix_match_respects_component_boundaries() {
        assert_eq!(classify_path("/etcetera/config"), PathClass::Ordinary);
        assert_eq!(classify_path("/bootstrap/data"), PathClass::Ordinary);
    }
}
