use std::sync::Arc;

use crate::approvals::ApprovalGate;
use crate::backend::InfrastructureBackend;
use crate::redactor::sanitize_json_value;
use crate::tokens::TokenAuthority;
use crate::tools::get_kyvon_mcp_tools;
use kyvon_core::mcp::McpRole;

/// How old the newest sample may be before health readings are reported as
/// stale. Generous next to the collector's one-second interval, so a brief
/// hiccup is not announced as a stopped collector.
const STALE_AFTER_MS: i64 = 5 * 60 * 1000;
use serde_json::{json, Value};

pub struct McpProtocolHandler {
    pub role: McpRole,
    pub token_auth: TokenAuthority,
    pub approval_gate: ApprovalGate,
    /// Where infrastructure facts come from, when anything is attached.
    ///
    /// `None` is the safe default and the one the gateway ships with: every
    /// tool then reports that no backend is attached rather than inventing an
    /// answer. Attaching one cannot grant execution — the trait is read-only
    /// by construction.
    backend: Option<Arc<dyn InfrastructureBackend>>,
}

impl McpProtocolHandler {
    pub fn new(role: McpRole) -> Self {
        Self {
            role,
            token_auth: TokenAuthority::new(60),
            approval_gate: ApprovalGate::new(),
            backend: None,
        }
    }

    /// Attach a source of infrastructure facts.
    pub fn with_backend(mut self, backend: Arc<dyn InfrastructureBackend>) -> Self {
        self.backend = Some(backend);
        self
    }

    /// Valid notifications have no response and must not trigger tool execution.
    pub async fn handle_message(&self, request_json: &str) -> Option<Value> {
        if let Ok(request) = serde_json::from_str::<Value>(request_json) {
            if request.is_object()
                && request["jsonrpc"] == "2.0"
                && request["method"].is_string()
                && request.get("id").is_none()
                && request.get("params").is_none_or(Value::is_object)
            {
                return None;
            }
        }
        Some(self.handle_rpc(request_json).await)
    }

    pub async fn handle_rpc(&self, request_json: &str) -> Value {
        let req: Value = match serde_json::from_str(request_json) {
            Ok(v) => v,
            Err(_) => {
                return json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": { "code": -32700, "message": "Invalid JSON" }
                });
            }
        };

        if !req.is_object()
            || req["jsonrpc"] != "2.0"
            || !req["method"].is_string()
            || !req
                .get("id")
                .is_some_and(|id| id.is_string() || id.is_number() || id.is_null())
        {
            return json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32600, "message": "Invalid request"}});
        }

        let id = req.get("id").cloned().unwrap_or(Value::Null);
        if req.get("params").is_some_and(|params| !params.is_object()) {
            return json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32602, "message": "Parameters must be an object"}});
        }
        let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(json!({}));

        let response = match method {
            "initialize" => json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "kyvonops-mcp",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
            "tools/list" => {
                let tools = get_kyvon_mcp_tools();
                let filtered: Vec<_> = tools
                    .into_iter()
                    .filter(|t| {
                        if !self.role.can_write() {
                            t.is_read_only
                        } else {
                            true
                        }
                    })
                    .map(|t| {
                        json!({
                            "name": t.name,
                            "description": t.description,
                            "inputSchema": t.input_schema
                        })
                    })
                    .collect();
                json!({ "tools": filtered })
            }
            "tools/call" => {
                let tool_name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                {
                    // Returned directly, without the sanitize below. A tool's
                    // payload is redacted structurally in `tool_ok` and only
                    // then serialized; running the *text* redactor across that
                    // serialized JSON masks from an opening brace to end of
                    // line, which corrupts the document rather than protecting
                    // anything — and left every response unparseable.
                    let result = self.dispatch_tool_call(tool_name, &args).await;
                    return json!({ "jsonrpc": "2.0", "id": id, "result": result });
                }
            }
            "resources/list" => json!({"resources": []}),
            "prompts/list" => json!({"prompts": []}),
            "ping" => json!({}),
            _ => {
                return json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32601, "message": "Method not found" }
                });
            }
        };

        // Strict Redaction Gate: Sanitize response before returning to AI
        let sanitized = sanitize_json_value(&response);

        json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": sanitized
        })
    }

    async fn dispatch_tool_call(&self, tool_name: &str, args: &Value) -> Value {
        let tools = get_kyvon_mcp_tools();
        let Some(tool_def) = tools.iter().find(|t| t.name == tool_name) else {
            return Self::tool_error("Unknown tool. No operation was executed.");
        };
        if let Err(message) = tool_def.validate_arguments(args) {
            return Self::tool_error(message);
        }
        {
            if !tool_def.is_read_only && !self.role.can_write() {
                return json!({
                    "content": [{
                        "type": "text",
                        "text": format!("Permission Denied: Current role ({:?}) cannot invoke state-mutating tool '{}'", self.role, tool_name)
                    }],
                    "isError": true
                });
            }

            // A client-supplied environment cannot establish a trusted target scope.
            // Until server scopes are resolved, developers cannot propose writes.
            if !tool_def.is_read_only && !self.role.can_deploy_production() {
                return Self::tool_error(
                    "Permission denied: trusted server and environment scopes are not configured.",
                );
            }

            // Do not create fake approvals that cannot reach a trusted human or executor.
            if !tool_def.is_read_only {
                return Self::tool_error("Unavailable: trusted approval and execution bridges are not configured. No approval was created and no operation was executed.");
            }
        }

        let Some(backend) = self.backend.as_ref() else {
            // Never turn missing implementation into operational success.
            return Self::tool_error(
                "Unavailable: this MCP gateway has no infrastructure backend attached. \
                 No operation was executed and no infrastructure state was verified.",
            );
        };

        let server_id = args.get("server_id").and_then(Value::as_str);

        match tool_name {
            "kyvon_server_list" => {
                let tag = args.get("tag").and_then(Value::as_str);
                match backend.list_servers().await {
                    Ok(servers) => {
                        // The schema advertises this filter, so it must be
                        // applied. Returning the whole inventory for
                        // `{"tag":"staging"}` hands an agent production hosts
                        // it has every reason to treat as staging — the tool
                        // would promise a scope it does not enforce.
                        let matched: Vec<_> = match tag {
                            Some(t) => servers
                                .into_iter()
                                .filter(|s| s.tags.iter().any(|have| have == t))
                                .collect(),
                            None => servers,
                        };
                        Self::tool_ok(json!({
                            "servers": matched,
                            "count": matched.len(),
                            "filtered_by_tag": tag,
                        }))
                    }
                    Err(e) => Self::tool_error(&format!("Could not read the inventory: {e}")),
                }
            }

            "kyvon_server_get" => {
                let Some(id) = server_id else {
                    return Self::tool_error("`server_id` is required.");
                };
                match backend.get_server(id).await {
                    // A deleted server is a fact, not a failure to retry.
                    Ok(None) => Self::tool_ok(json!({
                        "found": false,
                        "server_id": id,
                        "detail": "No server with this id exists in the local inventory.",
                    })),
                    Ok(Some(server)) => Self::tool_ok(json!({ "found": true, "server": server })),
                    Err(e) => Self::tool_error(&format!("Could not read server `{id}`: {e}")),
                }
            }

            "kyvon_server_health" => {
                let Some(id) = server_id else {
                    return Self::tool_error("`server_id` is required.");
                };
                match backend.latest_metrics(id).await {
                    Ok(readings) if readings.is_empty() => Self::tool_ok(json!({
                        "server_id": id,
                        "measured": false,
                        "detail": "No telemetry has ever been recorded for this server. \
                                   Health cannot be assessed, and no value is being estimated.",
                    })),
                    Ok(readings) => {
                        // "Never measured" and "measured, but not lately" are
                        // different facts about a host, and the second usually
                        // means the collector stopped — which is itself the
                        // useful signal. Staleness is stated, not hidden.
                        let newest = readings.iter().map(|r| r.recorded_at).max().unwrap_or(0);
                        let age_ms = kyvon_core::now_ms().saturating_sub(newest);
                        let stale = age_ms > STALE_AFTER_MS;
                        Self::tool_ok(json!({
                            "server_id": id,
                            "measured": true,
                            "stale": stale,
                            "as_of_ms": newest,
                            "age_ms": age_ms,
                            "readings": readings,
                            "note": if stale {
                                "These are the last recorded values, but the newest is older \
                                 than the collection interval — the collector appears to have \
                                 stopped. Do not treat them as current."
                            } else {
                                "Last recorded values from the local store, not a live probe."
                            },
                        }))
                    }
                    Err(e) => Self::tool_error(&format!("Could not read metrics for `{id}`: {e}")),
                }
            }

            // Naming a live connection would be wrong for several of these:
            // incidents, changes and capacity are local reads needing no host
            // at all, and an agent told to "connect first" would reconnect and
            // hit the same wall. What is missing is a wider backend (§118).
            _ => Self::tool_error(&format!(
                "Unavailable: `{tool_name}` is not exposed by the backend attached to this \
                 gateway. No operation was executed and no state was verified."
            )),
        }
    }

    /// A successful tool result, redacted on the way out.
    ///
    /// Every response passes through `sanitize_json_value` here rather than at
    /// each call site, so a new tool cannot forget to redact (§50).
    fn tool_ok(payload: Value) -> Value {
        let safe = sanitize_json_value(&payload);
        json!({
            "content": [{
                "type": "text",
                "text": serde_json::to_string_pretty(&safe).unwrap_or_else(|_| safe.to_string()),
            }],
            "isError": false
        })
    }

    fn tool_error(message: &str) -> Value {
        json!({"isError": true, "content": [{"type": "text", "text": message}]})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn notifications_are_silent_and_cannot_create_operations() {
        let handler = McpProtocolHandler::new(McpRole::Administrator);
        for method in ["notifications/initialized", "tools/call", "unknown"] {
            assert!(handler
                .handle_message(&json!({"jsonrpc": "2.0", "method": method}).to_string())
                .await
                .is_none());
        }
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[tokio::test]
    async fn rejects_invalid_envelopes_without_echoing_parameters() {
        let handler = McpProtocolHandler::new(McpRole::Observer);
        for request in [
            json!([]),
            json!({"method": "tools/list", "id": 1}),
            json!({"jsonrpc": "2.0", "method": "tools/list", "id": {"secret": "opaque"}}),
        ] {
            let response = handler.handle_rpc(&request.to_string()).await;
            assert_eq!(response["error"]["code"], -32600);
            assert!(!response.to_string().contains("opaque"));
        }
        let response = handler
            .handle_rpc(r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":[]}"#)
            .await;
        assert_eq!(response["error"]["code"], -32602);
    }

    #[tokio::test]
    async fn responds_to_initialize_and_tools_list() {
        let handler = McpProtocolHandler::new(McpRole::Developer);
        let req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        });

        let res = handler.handle_rpc(&req.to_string()).await;
        assert_eq!(res["jsonrpc"], "2.0");
        assert!(res["result"]["tools"].as_array().unwrap().len() >= 15);
    }

    #[tokio::test]
    async fn unconnected_mutation_fails_without_fake_approval() {
        let handler = McpProtocolHandler::new(McpRole::Operator);
        let req = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "kyvon_deploy",
                "arguments": {
                    "server_id": "prod-01",
                    "application": "shop-api",
                    "version": "1.8.3",
                    "environment": "production"
                }
            }
        });

        let res = handler.handle_rpc(&req.to_string()).await;
        assert_eq!(res["result"]["isError"], true);
        assert!(res["result"].get("request_id").is_none());
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[tokio::test]
    async fn unknown_and_unconnected_read_tools_never_report_success() {
        let handler = McpProtocolHandler::new(McpRole::Observer);
        for name in ["exec_shell", "kyvon_server_delete", "kyvon_server_health"] {
            let result = handler
                .dispatch_tool_call(name, &json!({"server_id": "prod-01"}))
                .await;
            assert_eq!(result["isError"], true);
            assert!(!result.to_string().contains("successfully"));
        }
    }

    #[tokio::test]
    async fn invalid_arguments_cannot_create_approvals() {
        let handler = McpProtocolHandler::new(McpRole::Administrator);
        for args in [
            json!({}),
            json!({"server_id": 1}),
            json!({"server_id": ""}),
            json!([]),
        ] {
            assert_eq!(
                handler
                    .dispatch_tool_call("kyvon_reload_nginx", &args)
                    .await["isError"],
                true
            );
        }
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[tokio::test]
    async fn developer_cannot_assert_staging_to_bypass_target_authorization() {
        let handler = McpProtocolHandler::new(McpRole::Developer);
        let result = handler.dispatch_tool_call("kyvon_deploy", &json!({
            "server_id": "prod-01", "application": "api", "version": "v1", "environment": "staging"
        })).await;
        assert_eq!(result["isError"], true);
        assert!(result.to_string().contains("Permission denied"));
        assert!(handler.approval_gate.get_pending().is_empty());
    }
}
