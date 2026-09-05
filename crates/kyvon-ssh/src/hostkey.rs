//! Host key identity and the trust decision around it.

use std::sync::Arc;

use kyvon_core::Result;
use russh::keys::PublicKeyOrCertificate;

/// A host key as the server presented it, in the forms needed to show it to
/// the operator and to compare it with what was trusted before.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PresentedKey {
    /// Algorithm name, e.g. `ssh-ed25519`.
    pub key_type: String,
    /// `SHA256:<base64>`, byte-identical to what `ssh-keyscan` and OpenSSH
    /// print, so an operator can compare it against a value from any source.
    pub fingerprint: String,
    /// The full `type base64` line, stored so a re-presented key is compared
    /// in full rather than by fingerprint alone.
    pub openssh: String,
}

impl PresentedKey {
    pub fn from_russh(key: &PublicKeyOrCertificate) -> Result<Self> {
        use kyvon_core::KyvonError;
        let public = match key {
            PublicKeyOrCertificate::PublicKey { key, .. } => key.clone(),
            PublicKeyOrCertificate::Certificate(cert) => {
                // A host certificate carries the key that actually signed the
                // exchange; that is what must be pinned.
                russh::keys::PublicKey::new(cert.public_key().clone(), cert.comment())
            }
        };
        let openssh = public
            .to_openssh()
            .map_err(|e| KyvonError::Transport(format!("could not encode host key: {e}")))?;
        Ok(Self {
            key_type: public.algorithm().as_str().to_string(),
            fingerprint: public
                .fingerprint(russh::keys::HashAlg::Sha256)
                .to_string(),
            openssh,
        })
    }
}

/// What the application decided about a presented host key.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    /// The key matches what was previously trusted, or the operator has just
    /// approved it.
    Trust,
    /// The operator declined, or the decision timed out. The connection is
    /// abandoned.
    Reject,
}

/// Decides whether a host key may be used.
///
/// The desktop's implementation consults the local `known_hosts` table and,
/// when the key is new or has changed, puts the decision to the operator and
/// waits. Returning [`Verdict::Trust`] unconditionally would defeat the point,
/// so the only such implementation in the codebase is the one used by tests,
/// and it is named to say so.
#[async_trait::async_trait]
pub trait HostKeyVerifier: Send + Sync {
    async fn verify(&self, host: &str, port: u16, key: &PresentedKey) -> Verdict;
}

/// Trusts everything. For tests against a disposable local server only.
#[derive(Debug, Clone, Copy)]
pub struct TrustEverythingForTests;

#[async_trait::async_trait]
impl HostKeyVerifier for TrustEverythingForTests {
    async fn verify(&self, _host: &str, _port: u16, _key: &PresentedKey) -> Verdict {
        Verdict::Trust
    }
}

/// Convenience alias for the shared verifier passed into a session.
pub type SharedVerifier = Arc<dyn HostKeyVerifier>;
