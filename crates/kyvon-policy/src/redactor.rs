use serde_json::Value;

pub const REDACTED_PLACEHOLDER: &str = "[REDACTED_SECRET]";

/// Scrubs secrets from text strings before responding to MCP clients.
pub fn sanitize_text(input: &str) -> String {
    let mut out = kyvon_core::redact(input);

    // Additional checks for SSH private keys
    if out.contains("BEGIN ") && out.contains("PRIVATE KEY") {
        out = "[REDACTED_SSH_KEY]".to_string();
    }

    out
}

/// Recursively sanitizes JSON values before sending to LLM.
pub fn sanitize_json_value(val: &Value) -> Value {
    match val {
        Value::String(s) => Value::String(sanitize_text(s)),
        Value::Array(arr) => Value::Array(arr.iter().map(sanitize_json_value).collect()),
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                let k_lower = k.to_lowercase();
                if k_lower.contains("password")
                    || k_lower.contains("secret")
                    || k_lower.contains("token")
                    || k_lower.contains("private_key")
                    || k_lower.contains("passphrase")
                    || k_lower.contains("auth_key")
                {
                    new_map.insert(k.clone(), Value::String(REDACTED_PLACEHOLDER.into()));
                } else {
                    new_map.insert(k.clone(), sanitize_json_value(v));
                }
            }
            Value::Object(new_map)
        }
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitizes_nested_json() {
        let input = json!({
            "server": "prod-01",
            "password": "super-secret-password",
            "config": {
                "api_token": "bearer 12345abcdef",
                "normal": "hello world"
            }
        });

        let sanitized = sanitize_json_value(&input);
        assert_eq!(sanitized["server"], "prod-01");
        assert_eq!(sanitized["password"], REDACTED_PLACEHOLDER);
        assert_eq!(sanitized["config"]["api_token"], REDACTED_PLACEHOLDER);
        assert_eq!(sanitized["config"]["normal"], "hello world");
    }
}
