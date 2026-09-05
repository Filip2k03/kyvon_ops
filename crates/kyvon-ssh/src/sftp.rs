//! Remote filesystem access over SFTP.
//!
//! Every path crossing into this module is normalised and validated by
//! [`kyvon_security::validate_remote_path`] first, so the target shown in a
//! confirmation dialog is exactly the target the operation will use.

use kyvon_core::{redact, KyvonError, Result, TimestampMs};
use kyvon_security::{path::classify_path, validate_remote_path, PathClass};
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};

/// Largest file the editor will open. Beyond this the file is offered as a
/// download instead, because loading it into Monaco would freeze the UI.
pub const MAX_EDITABLE_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    /// Absolute path, already normalised.
    pub path: String,
    pub kind: EntryKind,
    pub size_bytes: u64,
    /// Symbolic form, e.g. `rw-r--r--`.
    pub permissions: String,
    /// Octal form, e.g. `644`.
    pub mode: String,
    pub uid: u32,
    pub gid: u32,
    pub modified_ms: TimestampMs,
    /// True when the name suggests the file holds credentials, so the UI can
    /// warn before previewing it.
    pub likely_sensitive: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    File,
    Directory,
    Symlink,
    Other,
}

/// Names that usually contain secrets.
fn looks_sensitive(name: &str) -> bool {
    const NAMES: &[&str] = &[
        ".env",
        "id_rsa",
        "id_ed25519",
        "id_ecdsa",
        ".pem",
        ".key",
        ".p12",
        ".pfx",
        "credentials",
        ".netrc",
        ".pgpass",
        "shadow",
        ".htpasswd",
    ];
    let lower = name.to_ascii_lowercase();
    NAMES
        .iter()
        .any(|n| lower == *n || lower.ends_with(n) || lower.starts_with(n))
}

fn permissions_string(mode: u32) -> String {
    let bit = |shift: u32, ch: char| {
        if mode >> shift & 1 == 1 {
            ch
        } else {
            '-'
        }
    };
    format!(
        "{}{}{}{}{}{}{}{}{}",
        bit(8, 'r'),
        bit(7, 'w'),
        bit(6, 'x'),
        bit(5, 'r'),
        bit(4, 'w'),
        bit(3, 'x'),
        bit(2, 'r'),
        bit(1, 'w'),
        bit(0, 'x')
    )
}

/// List a directory.
pub async fn list_dir(sftp: &SftpSession, path: &str) -> Result<Vec<DirEntry>> {
    let path = validate_remote_path(path)?;
    let entries = sftp.read_dir(&path).await.map_err(map_sftp_error)?;

    let mut out = Vec::new();
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let meta = entry.metadata();
        let mode = meta.permissions.unwrap_or(0);
        let kind = if meta.is_dir() {
            EntryKind::Directory
        } else if meta.is_symlink() {
            EntryKind::Symlink
        } else if meta.is_regular() {
            EntryKind::File
        } else {
            EntryKind::Other
        };
        let child = if path == "/" {
            format!("/{name}")
        } else {
            format!("{path}/{name}")
        };
        out.push(DirEntry {
            path: child,
            kind,
            size_bytes: meta.size.unwrap_or(0),
            permissions: permissions_string(mode),
            mode: format!("{:03o}", mode & 0o777),
            uid: meta.uid.unwrap_or(0),
            gid: meta.gid.unwrap_or(0),
            modified_ms: meta.mtime.unwrap_or(0) as TimestampMs * 1000,
            likely_sensitive: looks_sensitive(&name),
            name,
        });
    }
    // Directories first, then case-insensitive by name — the ordering a file
    // manager is expected to have.
    out.sort_by(|a, b| {
        (b.kind == EntryKind::Directory)
            .cmp(&(a.kind == EntryKind::Directory))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

/// Read a file for editing.
///
/// Refuses files above [`MAX_EDITABLE_BYTES`] and files that are not valid
/// UTF-8, rather than showing mojibake that would be written back corrupted.
pub async fn read_text_file(sftp: &SftpSession, path: &str) -> Result<String> {
    use tokio::io::AsyncReadExt;

    let path = validate_remote_path(path)?;
    let meta = sftp.metadata(&path).await.map_err(map_sftp_error)?;
    if let Some(size) = meta.size {
        if size > MAX_EDITABLE_BYTES {
            return Err(KyvonError::Invalid(format!(
                "{path} is {size} bytes; KyvonOPS opens files up to {MAX_EDITABLE_BYTES} bytes in the editor"
            )));
        }
    }

    let mut file = sftp.open(&path).await.map_err(map_sftp_error)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).await?;

    String::from_utf8(buf).map_err(|_| {
        KyvonError::Invalid(format!(
            "{path} is not valid UTF-8 text and cannot be edited safely"
        ))
    })
}

/// Write a file back.
///
/// The caller is responsible for having obtained confirmation; this function
/// only enforces that the path is well-formed and reports what it wrote.
pub async fn write_text_file(sftp: &SftpSession, path: &str, contents: &str) -> Result<()> {
    use tokio::io::AsyncWriteExt;

    let path = validate_remote_path(path)?;
    let mut file = sftp.create(&path).await.map_err(map_sftp_error)?;
    file.write_all(contents.as_bytes()).await?;
    file.flush().await?;
    Ok(())
}

/// A preview of a file's first lines, with probable secrets masked.
pub async fn preview(sftp: &SftpSession, path: &str, max_lines: usize) -> Result<String> {
    let text = read_text_file(sftp, path).await?;
    let head: String = text.lines().take(max_lines).collect::<Vec<_>>().join("\n");
    Ok(redact(&head))
}

/// Whether a delete of this path needs the strongest confirmation.
pub fn deletion_requires_typed_confirmation(path: &str) -> bool {
    classify_path(path) != PathClass::Ordinary
}

fn map_sftp_error(e: russh_sftp::client::error::Error) -> KyvonError {
    let msg = e.to_string();
    let lower = msg.to_lowercase();
    if lower.contains("permission") {
        KyvonError::PermissionDenied(msg)
    } else {
        KyvonError::Sftp(msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_unix_permission_bits() {
        assert_eq!(permissions_string(0o644), "rw-r--r--");
        assert_eq!(permissions_string(0o755), "rwxr-xr-x");
        assert_eq!(permissions_string(0o600), "rw-------");
        assert_eq!(permissions_string(0o777), "rwxrwxrwx");
    }

    #[test]
    fn flags_files_that_usually_hold_credentials() {
        assert!(looks_sensitive(".env"));
        assert!(looks_sensitive(".env.production"));
        assert!(looks_sensitive("id_ed25519"));
        assert!(looks_sensitive("server.key"));
        assert!(looks_sensitive("shadow"));
        assert!(!looks_sensitive("nginx.conf"));
        assert!(!looks_sensitive("index.html"));
    }

    #[test]
    fn deleting_system_paths_needs_the_strongest_confirmation() {
        assert!(deletion_requires_typed_confirmation(
            "/etc/nginx/nginx.conf"
        ));
        assert!(deletion_requires_typed_confirmation("/boot/vmlinuz"));
        assert!(!deletion_requires_typed_confirmation(
            "/var/www/html/old.html"
        ));
    }
}
