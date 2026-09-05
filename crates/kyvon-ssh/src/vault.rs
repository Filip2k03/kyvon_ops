//! Secrets in the OS keychain, never in the application's own database.
//!
//! `kyvon-storage` holds connection *shape* — host, port, user, which method
//! to use, which key file. The secret itself (a password, or a key
//! passphrase) lives in the platform credential store: Keychain on macOS, the
//! Credential Manager on Windows, the Secret Service on Linux. That means an
//! attacker who copies the SQLite file gets an inventory, not access.

use kyvon_core::{KyvonError, Result};

const SERVICE: &str = "com.kyvon.ops";

/// Which secret is being stored for a server.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretKind {
    /// The login password.
    Password,
    /// The passphrase protecting a private key file.
    KeyPassphrase,
}

impl SecretKind {
    fn suffix(self) -> &'static str {
        match self {
            SecretKind::Password => "password",
            SecretKind::KeyPassphrase => "key-passphrase",
        }
    }
}

/// Handle to the platform credential store.
#[derive(Debug, Clone, Copy, Default)]
pub struct Vault;

impl Vault {
    pub fn new() -> Self {
        Self
    }

    fn entry(server_id: &str, kind: SecretKind) -> Result<keyring::Entry> {
        keyring::Entry::new(SERVICE, &format!("{server_id}/{}", kind.suffix()))
            .map_err(|e| KyvonError::Vault(e.to_string()))
    }

    pub fn store(&self, server_id: &str, kind: SecretKind, secret: &str) -> Result<()> {
        Self::entry(server_id, kind)?
            .set_password(secret)
            .map_err(|e| KyvonError::Vault(e.to_string()))
    }

    /// Retrieve a secret. A missing entry is `Ok(None)`, not an error: a
    /// server configured for agent authentication legitimately has none.
    pub fn get(&self, server_id: &str, kind: SecretKind) -> Result<Option<String>> {
        match Self::entry(server_id, kind)?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(KyvonError::Vault(e.to_string())),
        }
    }

    /// Remove a secret. Deleting one that is already absent succeeds, so
    /// removing a server is idempotent.
    pub fn delete(&self, server_id: &str, kind: SecretKind) -> Result<()> {
        match Self::entry(server_id, kind)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(KyvonError::Vault(e.to_string())),
        }
    }

    /// Remove every secret belonging to a server.
    pub fn delete_all(&self, server_id: &str) -> Result<()> {
        self.delete(server_id, SecretKind::Password)?;
        self.delete(server_id, SecretKind::KeyPassphrase)
    }
}
