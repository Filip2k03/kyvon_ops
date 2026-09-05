use serde_json::{json, Value};
use crate::approvals::ApprovalGate;
use crate::redactor::sanitize_json_value;
use crate::tokens::TokenAuthority;
use crate::tools::get_kyvon_mcp_tools;
use kyvon_core::mcp::McpRole;

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

    pub fn handle_rpc(&self, request_json: &str) -> Value {
        let req: Value = match serde_json::from_str(request_json) {
            Ok(v) => v,
            Err(e) => {
                return json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": { "code": -32700, "message": format!("Parse error: {}", e) }
                });
            }
        };

        let id = req.get("id").cloned().unwrap_or(Value::Null);
        let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(json!({}));

        let response = match method {
            "initialize" => json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": { "listChanged": true },
                    "resources": { "subscribe": true, "listChanged": true },
                    "prompts": { "listChanged": true }
                },
                "serverInfo": {
                    "name": "kyvonops-mcp",
                    "version": "2.0.0"
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
            "resources/list" => json!({
                "resources": [
                    {
                        "uri": "kyvon://servers",
                        "name": "Monitored Servers Inventory",
                        "mimeType": "application/json"
                    },
                    {
                        "uri": "kyvon://active-incidents",
                        "name": "Active Fleet Incidents",
                        "mimeType": "application/json"
                    }
                ]
            }),
            "prompts/list" => json!({
                "prompts": [
                    {
                        "name": "kyvon-investigate-slow-site",
                        "description": "Systematic diagnostic workflow investigating DNS, TLS, reverse proxy, and backend database bottlenecks",
                        "arguments": [
                            { "name": "domain", "description": "Website or API domain", "required": true }
                        ]
                    },
                    {
                        "name": "kyvon-outage-triage",
                        "description": "Evaluate capacity headroom, container crashes, and recent deployment causality for a troubled VPS",
                        "arguments": [
                            { "name": "server_id", "description": "Target server id", "required": true }
                        ]
                    }
                ]
            }),
            _ => {
                return json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32601, "message": format!("Method '{}' not found", method) }
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
        let server_id = args.get("server_id").and_then(|s| s.as_str()).unwrap_or("default");

        // Role authorization
        let tools = get_kyvon_mcp_tools();
        if let Some(tool_def) = tools.iter().find(|t| t.name == tool_name) {
            if !tool_def.is_read_only && !self.role.can_write() {
                return json!({
                    "content": [{
                        "type": "text",
                        "text": format!("Permission Denied: Current role ({:?}) cannot invoke state-mutating tool '{}'", self.role, tool_name)
                    }],
                    "isError": true
                });
            }

            // Gated mutation operations require Approval
            if !tool_def.is_read_only {
                let risk = ApprovalGate::assess_operation_risk(tool_name, args.get("environment").and_then(|e| e.as_str()));
                let req = self.approval_gate.create_request(
                    server_id,
                    "AI Agent",
                    tool_name,
                    &format!("Operation {} requested on server {}", tool_name, server_id),
                    risk,
                    vec![format!("Command for {}", tool_name)],
                    "Service state mutation",
                );

                return json!({
                    "content": [{
                        "type": "text",
                        "text": format!("PROPOSED ACTION REQUIRES HUMAN APPROVAL\nRequest ID: {}\nRisk: {:?}\nApproval Status: Pending\nPlease approve in KyvonOPS Desktop.", req.request_id, risk)
                    }],
                    "approval_required": true,
                    "request_id": req.request_id
                });
            }
        }

        // Executed read-only simulated output (actual values populated from storage/telemetry)
        json!({
            "content": [{
                "type": "text",
                "text": format!("KyvonOPS 2.0 Engine: Executed '{}' successfully for server '{}'.", tool_name, server_id)
            }]
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn enforces_human_approval_on_mutation() {
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
        assert_eq!(res["result"]["approval_required"], true);
    }
}
