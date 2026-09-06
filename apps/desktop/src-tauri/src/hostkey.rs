//! The desktop's host key trust decision.
//!
//! `kyvon-ssh` requires a [`HostKeyVerifier`] to open a session and has no
//! path that returns "trusted" without asking one. This is the real
//! implementation: it consults the local `known_hosts` table, and when a key
//! is new or has *changed*, it puts the decision to the operator and blocks
//! the connection until they answer.
//!
//! Two properties matter more than the plumbing:
//!
//! * A timeout resolves to [`Verdict::Reject`], never to trust. If the window
//!   is closed or the operator walks away, the connection is abandoned.
//! * A changed key is reported as changed, carrying the fingerprint that was
//!   trusted before, because that is the case where the difference between
//!   "new host" and "possible interception" actually matters.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use kyvon_core::{HostKeyPrompt, KnownHost, KyvonEvent};
use kyvon_ssh::{HostKeyVerifier, PresentedKey, Verdict};
use kyvon_storage::{Database, KnownHostRepo};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use uuid::Uuid;

/// How long an unanswered prompt waits before the connection is abandoned.
const PROMPT_TIMEOUT: Duration = Duration::from_secs(120);

/// Prompts awaiting an operator decision, keyed by prompt id.
#[derive(Default)]
pub struct PendingPrompts {
    waiting: Mutex<HashMap<String, oneshot::Sender<bool>>>,
}

impl PendingPrompts {
    /// Deliver the operator's answer. Returns false when the id is unknown —
    /// already answered, or timed out — so a late or replayed response cannot
    /// authorise anything.
    pub fn resolve(&self, prompt_id: &str, trust: bool) -> bool {
        let sender = self.waiting.lock().unwrap().remove(prompt_id);
        match sender {
            Some(tx) => tx.send(trust).is_ok(),
            None => false,
        }
    }

    fn register(&self, prompt_id: String) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        self.waiting.lock().unwrap().insert(prompt_id, tx);
        rx
    }

    fn forget(&self, prompt_id: &str) {
        self.waiting.lock().unwrap().remove(prompt_id);
    }
}

pub struct DesktopVerifier {
    db: Database,
    app: AppHandle,
    prompts: Arc<PendingPrompts>,
    server_id: String,
}

impl DesktopVerifier {
    pub fn new(
        db: Database,
        app: AppHandle,
        prompts: Arc<PendingPrompts>,
        server_id: String,
    ) -> Self {
        Self {
            db,
            app,
            prompts,
            server_id,
        }
    }

    fn emit_state(&self, state: kyvon_core::ConnectionState, message: Option<String>) {
        let _ = self.app.emit(
            "kyvon-event",
            KyvonEvent::ConnectionState {
                server_id: self.server_id.clone(),
                state,
                message,
            },
        );
    }

    /// Ask the operator about a key and wait for the answer.
    async fn ask(&self, prompt: HostKeyPrompt) -> Verdict {
        let prompt_id = format!("hk_{}", Uuid::new_v4().simple());
        let rx = self.prompts.register(prompt_id.clone());

        // The prompt id travels in the event's own envelope so the frontend
        // can answer the specific question it was asked.
        if self
            .app
            .emit(
                "kyvon-host-key-prompt",
                serde_json::json!({ "prompt_id": prompt_id, "prompt": prompt }),
            )
            .is_err()
        {
            // No window to ask. Refuse rather than assume.
            self.prompts.forget(&prompt_id);
            return Verdict::Reject;
        }

        match tokio::time::timeout(PROMPT_TIMEOUT, rx).await {
            Ok(Ok(true)) => Verdict::Trust,
            // Declined, channel dropped, or timed out — all refuse.
            _ => {
                self.prompts.forget(&prompt_id);
                Verdict::Reject
            }
        }
    }
}

#[async_trait::async_trait]
impl HostKeyVerifier for DesktopVerifier {
    async fn verify(&self, host: &str, port: u16, key: &PresentedKey) -> Verdict {
        // `ConnectionState` documents a state machine whose legal transitions
        // are `Connecting -> VerifyingHost -> Authenticating -> Connected`, so
        // that no event can report `Connected` without having authenticated.
        // This callback is the only place that knows when host verification
        // actually begins, so it is what keeps the emitted sequence legal —
        // `connect` alone could only jump from Connecting to Connected.
        self.emit_state(kyvon_core::ConnectionState::VerifyingHost, None);

        let repo = KnownHostRepo::new(self.db.clone());

        let status = match repo.status(host, port, &key.openssh).await {
            Ok(s) => s,
            // A store we cannot read is not evidence of trust.
            Err(e) => {
                self.emit_state(
                    kyvon_core::ConnectionState::Error,
                    Some(format!("could not read known hosts: {e}")),
                );
                return Verdict::Reject;
            }
        };

        let previous_fingerprint = match status {
            kyvon_storage::HostKeyStatus::Known => {
                self.emit_state(kyvon_core::ConnectionState::Authenticating, None);
                return Verdict::Trust;
            }
            kyvon_storage::HostKeyStatus::Unknown => None,
            kyvon_storage::HostKeyStatus::Changed {
                previous_fingerprint,
            } => Some(previous_fingerprint),
        };

        let verdict = self
            .ask(HostKeyPrompt {
                server_id: self.server_id.clone(),
                host: host.to_string(),
                port,
                key_type: key.key_type.clone(),
                fingerprint: key.fingerprint.clone(),
                public_key: key.openssh.clone(),
                previous_fingerprint,
            })
            .await;

        // Only persist trust the operator actually granted.
        if verdict == Verdict::Trust {
            let record = KnownHost {
                host: host.to_string(),
                port,
                key_type: key.key_type.clone(),
                fingerprint: key.fingerprint.clone(),
                public_key: key.openssh.clone(),
                trusted_at: kyvon_core::now_ms(),
            };
            if let Err(e) = repo.trust(&record).await {
                // The key is good for this session but was not remembered;
                // say so rather than silently re-prompting next time.
                self.emit_state(
                    kyvon_core::ConnectionState::VerifyingHost,
                    Some(format!("host key trusted but not saved: {e}")),
                );
            }
            self.emit_state(kyvon_core::ConnectionState::Authenticating, None);
        }

        verdict
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A prompt id is single-use. Answering it twice, or answering one that
    /// was never issued, must not authorise anything — otherwise a replayed
    /// "trust" could approve a *later* host key the operator never saw.
    #[tokio::test]
    async fn a_prompt_id_authorises_exactly_once() {
        let prompts = PendingPrompts::default();
        let rx = prompts.register("hk_known".into());

        assert!(
            prompts.resolve("hk_known", true),
            "first answer is delivered"
        );
        assert!(rx.await.unwrap(), "the waiting verifier sees the decision");

        assert!(
            !prompts.resolve("hk_known", true),
            "the same id cannot be answered twice"
        );
        assert!(
            !prompts.resolve("hk_never_issued", true),
            "an id that was never issued cannot be answered"
        );
    }

    /// A timed-out prompt is forgotten, so a late answer arriving after the
    /// connection was abandoned cannot resurrect it.
    #[tokio::test]
    async fn a_forgotten_prompt_cannot_be_answered_late() {
        let prompts = PendingPrompts::default();
        let _rx = prompts.register("hk_expired".into());

        prompts.forget("hk_expired");

        assert!(!prompts.resolve("hk_expired", true));
    }

    /// Declining is delivered as an explicit decline rather than merely
    /// dropped. The verifier refuses on both, but this pins the explicit path.
    #[tokio::test]
    async fn declining_is_delivered_as_a_decline() {
        let prompts = PendingPrompts::default();
        let rx = prompts.register("hk_declined".into());

        assert!(prompts.resolve("hk_declined", false));
        assert!(!rx.await.unwrap());
    }
}
