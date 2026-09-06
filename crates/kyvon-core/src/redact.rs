//! Secret redaction (specification §77).
//!
//! Applied to everything that leaves the SSH boundary heading for a log, the
//! audit ledger, an exported report or the UI: command lines, environment
//! dumps, file previews and error strings. Redaction is deliberately eager —
//! a false positive costs a hidden value, a false negative leaks a credential.

/// Keys whose value is a secret whenever they appear as `key=value`,
/// `key: value`, `--key value` or `"key": "value"`.
const SECRET_KEYS: &[&str] = &[
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_key",
    "secret_key",
    "private_key",
    "auth",
    "authorization",
    "credential",
    "credentials",
    "session",
    "cookie",
    "database_url",
    "db_url",
    "dsn",
    "connection_string",
    "client_secret",
    "refresh_token",
    "bearer",
    "passphrase",
];

pub const MASK: &str = "«redacted»";

/// Replace probable secrets in `input` with [`MASK`].
///
/// Handles four shapes seen in real command lines and config output:
///   * `KEY=value` and `KEY: value`
///   * `--key value` and `-p value`
///   * `scheme://user:password@host`
///   * PEM private key blocks
pub fn redact(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for (i, line) in input.split_inclusive('\n').enumerate() {
        let _ = i;
        out.push_str(&redact_line(line));
    }
    strip_pem_bodies(&out)
}

fn redact_line(line: &str) -> String {
    let mut result = String::with_capacity(line.len());
    let mut rest = line;

    while !rest.is_empty() {
        match next_secret_span(rest) {
            Some((start, end)) => {
                result.push_str(&rest[..start]);
                result.push_str(MASK);
                rest = &rest[end..];
            }
            None => {
                result.push_str(rest);
                break;
            }
        }
    }
    result
}

/// Find the byte range of the next secret *value* in `s`, if any.
///
/// Works on whole tokens rather than raw substrings so that `PGPASSWORD`,
/// `DB_PASSWORD` and `--api-key` all match while `crossword` does not. The
/// match is deliberately generous at the token edges (a token that merely
/// *ends* with `password` counts) because a missed credential is far more
/// costly than an over-eager mask.
fn next_secret_span(s: &str) -> Option<(usize, usize)> {
    let mut best: Option<(usize, usize)> = None;

    for (tstart, tend) in tokens(s) {
        if !is_secret_key(&s[tstart..tend]) {
            continue;
        }
        if let Some((vs, ve)) = value_span_after(s, tend) {
            if ve > vs && best.is_none_or(|b| vs < b.0) {
                best = Some((vs, ve));
            }
        }
    }

    // A URL with inline credentials hides the secret in the authority section.
    if let Some((vs, ve)) = url_credential_span(s) {
        if best.is_none_or(|b| vs < b.0) {
            best = Some((vs, ve));
        }
    }

    best
}

/// Byte spans of maximal identifier-like runs, the shape a config key takes.
fn tokens(s: &str) -> Vec<(usize, usize)> {
    fn is_token_char(b: u8) -> bool {
        b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.')
    }
    let bytes = s.as_bytes();
    let mut spans = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if is_token_char(bytes[i]) {
            let start = i;
            while i < bytes.len() && is_token_char(bytes[i]) {
                i += 1;
            }
            spans.push((start, i));
        } else {
            i += 1;
        }
    }
    spans
}

fn is_secret_key(token: &str) -> bool {
    let lowered = token.to_ascii_lowercase();
    let t = lowered.trim_matches(|c| c == '-' || c == '.' || c == '_');
    SECRET_KEYS.iter().any(|k| {
        t == *k
            || t.ends_with(k)
            || t.starts_with(k)
            || t.split(['_', '-', '.']).any(|part| part == *k)
    })
}

/// Given a position just past a secret key, return the span of its value.
fn value_span_after(s: &str, key_end: usize) -> Option<(usize, usize)> {
    let bytes = s.as_bytes();
    let mut i = key_end;

    // Skip a quote or trailing word characters that were part of the key
    // token, e.g. the closing quote of `"password"`.
    while i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'') {
        i += 1;
    }
    // Separator.
    let sep_start = i;
    while i < bytes.len() && (bytes[i] == b' ' || bytes[i] == b'\t') {
        i += 1;
    }
    let has_sep = match bytes.get(i) {
        Some(b'=') | Some(b':') => {
            i += 1;
            true
        }
        // `--password value` style: whitespace alone separates key and value.
        _ => i > sep_start,
    };
    if !has_sep {
        return None;
    }
    while i < bytes.len() && (bytes[i] == b' ' || bytes[i] == b'\t') {
        i += 1;
    }
    // A credential is a scalar. When the value opens a JSON or array
    // container, this is a structured document rather than a `key=secret`
    // assignment, and masking from the brace to end-of-line would truncate the
    // container and leave its contents orphaned — producing invalid JSON while
    // protecting nothing. Structured payloads are redacted key-by-key by
    // `kyvon_policy::redactor` instead, which descends into the container and
    // masks the leaf values that actually hold secrets.
    if matches!(bytes.get(i), Some(b'{') | Some(b'[')) {
        return None;
    }

    // Optional opening quote around the value.
    let quote = match bytes.get(i) {
        Some(&q @ (b'"' | b'\'')) => {
            i += 1;
            Some(q)
        }
        _ => None,
    };
    let start = i;
    while i < bytes.len() {
        let b = bytes[i];
        match quote {
            Some(q) if b == q => break,
            None if b == b' ' || b == b'\t' || b == b'\n' || b == b'\r' || b == b',' => break,
            _ => i += 1,
        }
    }
    (i > start).then_some((start, i))
}

/// Span of the password in `scheme://user:password@host`.
fn url_credential_span(s: &str) -> Option<(usize, usize)> {
    let scheme = s.find("://")?;
    let auth_start = scheme + 3;
    let at = s[auth_start..].find('@')? + auth_start;
    let colon = s[auth_start..at].find(':')? + auth_start;
    (at > colon + 1).then_some((colon + 1, at))
}

/// Replace the body of any PEM block with a single masked line.
fn strip_pem_bodies(s: &str) -> String {
    const BEGIN: &str = "-----BEGIN";
    const END: &str = "-----END";
    if !s.contains(BEGIN) {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len());
    let mut in_block = false;
    for line in s.split_inclusive('\n') {
        let trimmed = line.trim_start();
        if trimmed.starts_with(BEGIN) {
            in_block = true;
            out.push_str(line);
            continue;
        }
        if trimmed.starts_with(END) {
            if in_block {
                out.push_str(MASK);
                out.push('\n');
            }
            in_block = false;
            out.push_str(line);
            continue;
        }
        if !in_block {
            out.push_str(line);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_container_value_is_left_intact_so_json_stays_parseable() {
        // `"auth": {` used to mask from the brace to end-of-line, truncating
        // the object and making the whole document unparseable. The nested
        // scalars are still redacted by the structured redactor.
        let doc = "{\n  \"auth\": {\n    \"type\": \"agent\"\n  }\n}";
        assert_eq!(redact(doc), doc, "a container value must survive redaction");

        let list = "authorized_keys: [\"ssh-ed25519 AAAA\"]";
        assert!(
            !redact(list).contains(MASK),
            "an array value is not a secret"
        );
    }

    #[test]
    fn a_scalar_secret_is_still_masked() {
        assert!(redact("password: hunter2").contains(MASK));
        assert!(!redact("password: hunter2").contains("hunter2"));
        assert!(redact("{\"api_key\": \"sk-live-abc\"}").contains(MASK));
    }

    use super::*;

    #[test]
    fn masks_env_assignment() {
        let got = redact("PGPASSWORD=hunter2 psql -h db");
        assert!(!got.contains("hunter2"), "leaked: {got}");
        assert!(got.contains("psql -h db"));
    }

    #[test]
    fn masks_flag_value() {
        let got = redact("mysql -u root --password s3cr3t --host db01");
        assert!(!got.contains("s3cr3t"), "leaked: {got}");
        assert!(got.contains("--host db01"));
    }

    #[test]
    fn masks_url_credentials() {
        let got = redact("DATABASE_URL=postgres://app:tOpS3cret@db:5432/prod");
        assert!(!got.contains("tOpS3cret"), "leaked: {got}");
    }

    #[test]
    fn masks_json_token() {
        let got = redact(r#"{"api_key": "ak_live_9182", "region": "eu"}"#);
        assert!(!got.contains("ak_live_9182"), "leaked: {got}");
        assert!(got.contains("eu"));
    }

    #[test]
    fn masks_pem_body() {
        let pem = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\nAAAABBBB\n-----END OPENSSH PRIVATE KEY-----\n";
        let got = redact(pem);
        assert!(!got.contains("b3BlbnNzaC1rZXktdjEAAAA"), "leaked: {got}");
        assert!(got.contains("BEGIN OPENSSH PRIVATE KEY"));
    }

    #[test]
    fn leaves_ordinary_output_alone() {
        let input = "nginx.service  loaded active running  A high performance web server";
        assert_eq!(redact(input), input);
    }

    #[test]
    fn handles_multiple_secrets_on_one_line() {
        let got = redact("app --token abc123 --secret def456 --port 8080");
        assert!(!got.contains("abc123"), "leaked: {got}");
        assert!(!got.contains("def456"), "leaked: {got}");
        assert!(got.contains("8080"));
    }
}
