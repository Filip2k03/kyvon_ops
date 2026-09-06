use crate::approvals::ApprovalGate;
use crate::redactor::sanitize_json_value;
use crate::tokens::TokenAuthority;
use crate::tools::get_kyvon_mcp_tools;
use kyvon_core::mcp::McpRole;
use serde_json::{json, Value};

pub struct McpProtocolHandler {
    pub role: McpRole,
    pub token_auth: TokenAuthority,
    pub approval_gate: ApprovalGate,
}

impl McpProtocolHandler {
    pub fn new(role: McpRole) -> Self {
        Self {
            role,
            token_auth: TokenAuthority::new(60),
            approval_gate: ApprovalGate::new(),
        }
    }

    /// Valid notifications have no response and must not trigger tool execution.
    pub fn handle_message(&self, request_json: &str) -> Option<Value> {
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
        Some(self.handle_rpc(request_json))
    }

    pub fn handle_rpc(&self, request_json: &str) -> Value {
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
                self.dispatch_tool_call(tool_name, &args)
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

    fn dispatch_tool_call(&self, tool_name: &str, args: &Value) -> Value {
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

        // There is no storage/telemetry or trusted execution bridge attached yet.
        // Never turn missing implementation into operational success.
        json!({
            "content": [{
                "type": "text",
                "text": "Unavailable: this MCP gateway has no infrastructure backend attached. No operation was executed and no infrastructure state was verified."
            }],
            "isError": true
        })
    }

    fn tool_error(message: &str) -> Value {
        json!({"isError": true, "content": [{"type": "text", "text": message}]})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notifications_are_silent_and_cannot_create_operations() {
        let handler = McpProtocolHandler::new(McpRole::Administrator);
        for method in ["notifications/initialized", "tools/call", "unknown"] {
            assert!(handler
                .handle_message(&json!({"jsonrpc": "2.0", "method": method}).to_string())
                .is_none());
        }
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[test]
    fn rejects_invalid_envelopes_without_echoing_parameters() {
        let handler = McpProtocolHandler::new(McpRole::Observer);
        for request in [
            json!([]),
            json!({"method": "tools/list", "id": 1}),
            json!({"jsonrpc": "2.0", "method": "tools/list", "id": {"secret": "opaque"}}),
        ] {
            let response = handler.handle_rpc(&request.to_string());
            assert_eq!(response["error"]["code"], -32600);
            assert!(!response.to_string().contains("opaque"));
        }
        let response =
            handler.handle_rpc(r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":[]}"#);
        assert_eq!(response["error"]["code"], -32602);
    }

    #[test]
    fn responds_to_initialize_and_tools_list() {
        let handler = McpProtocolHandler::new(McpRole::Developer);
        let req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        });

        let res = handler.handle_rpc(&req.to_string());
        assert_eq!(res["jsonrpc"], "2.0");
        assert!(res["result"]["tools"].as_array().unwrap().len() >= 15);
    }

    #[test]
    fn unconnected_mutation_fails_without_fake_approval() {
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

        let res = handler.handle_rpc(&req.to_string());
        assert_eq!(res["result"]["isError"], true);
        assert!(res["result"].get("request_id").is_none());
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[test]
    fn unknown_and_unconnected_read_tools_never_report_success() {
        let handler = McpProtocolHandler::new(McpRole::Observer);
        for name in ["exec_shell", "kyvon_server_delete", "kyvon_server_health"] {
            let result = handler.dispatch_tool_call(name, &json!({"server_id": "prod-01"}));
            assert_eq!(result["isError"], true);
            assert!(!result.to_string().contains("successfully"));
        }
    }

    #[test]
    fn invalid_arguments_cannot_create_approvals() {
        let handler = McpProtocolHandler::new(McpRole::Administrator);
        for args in [
            json!({}),
            json!({"server_id": 1}),
            json!({"server_id": ""}),
            json!([]),
        ] {
            assert_eq!(
                handler.dispatch_tool_call("kyvon_reload_nginx", &args)["isError"],
                true
            );
        }
        assert!(handler.approval_gate.get_pending().is_empty());
    }

    #[test]
    fn developer_cannot_assert_staging_to_bypass_target_authorization() {
        let handler = McpProtocolHandler::new(McpRole::Developer);
        let result = handler.dispatch_tool_call("kyvon_deploy", &json!({
            "server_id": "prod-01", "application": "api", "version": "v1", "environment": "staging"
        }));
        assert_eq!(result["isError"], true);
        assert!(result.to_string().contains("Permission denied"));
        assert!(handler.approval_gate.get_pending().is_empty());
    }
}
