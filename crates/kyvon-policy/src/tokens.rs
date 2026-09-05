use kyvon_core::mcp::EphemeralToken;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

pub struct TokenAuthority {
    tokens: Mutex<HashMap<String, EphemeralToken>>,
    ttl_seconds: i64,
}

impl TokenAuthority {
    pub fn new(ttl_seconds: i64) -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
            ttl_seconds,
        }
    }

    pub fn issue_token(&self, server_id: &str, scope: &str) -> EphemeralToken {
        let token_id = format!("kyvon_tok_{}", Uuid::new_v4().simple());
        let now = kyvon_core::now_ms();
        let expires_at_ms = now.saturating_add(self.ttl_seconds.max(0).saturating_mul(1000));

        let token = EphemeralToken {
            token_id: token_id.clone(),
            server_id: server_id.to_string(),
            scope: scope.to_string(),
            issued_at_ms: now,
            expires_at_ms,
        };

        let mut lock = self.tokens.lock().unwrap();
        lock.insert(token_id, token.clone());
        token
    }

    /// Verifies token and consumes it if single-use.
    pub fn verify_and_consume(
        &self,
        token_id: &str,
        server_id: &str,
        required_scope: &str,
    ) -> Result<bool, &'static str> {
        let mut lock = self.tokens.lock().unwrap();
        let now = kyvon_core::now_ms();

        // Prune expired
        lock.retain(|_, t| t.expires_at_ms > now);

        if let Some(tok) = lock.remove(token_id) {
            if !tok.is_valid(now) {
                return Err("token has expired");
            }
            if tok.server_id != server_id {
                return Err("token server mismatch");
            }
            if tok.scope != required_scope && tok.scope != "*" {
                return Err("token scope unauthorized");
            }
            Ok(true)
        } else {
            Err("invalid or previously consumed token")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expired_tokens_and_wrong_targets_are_denied() {
        for ttl in [0, -1, i64::MIN] {
            let auth = TokenAuthority::new(ttl);
            let token = auth.issue_token("prod-01", "restart_nginx");
            assert!(auth
                .verify_and_consume(&token.token_id, "prod-01", "restart_nginx")
                .is_err());
        }
        let auth = TokenAuthority::new(60);
        let token = auth.issue_token("prod-01", "restart_nginx");
        assert!(auth
            .verify_and_consume(&token.token_id, "prod-02", "restart_nginx")
            .is_err());
        let token = auth.issue_token("prod-01", "restart_nginx");
        assert!(auth
            .verify_and_consume(&token.token_id, "prod-01", "deploy")
            .is_err());
    }

    #[test]
    fn issues_and_verifies_ephemeral_token() {
        let auth = TokenAuthority::new(60);
        let tok = auth.issue_token("prod-01", "restart_nginx");
        assert!(tok.is_valid(kyvon_core::now_ms()));

        // Valid consumption
        let res = auth.verify_and_consume(&tok.token_id, "prod-01", "restart_nginx");
        assert!(res.is_ok());

        // Single-use cannot be reused
        let retry = auth.verify_and_consume(&tok.token_id, "prod-01", "restart_nginx");
        assert!(retry.is_err());
    }
}
