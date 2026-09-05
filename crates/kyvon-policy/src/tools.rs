use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct McpToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub is_read_only: bool,
}

impl McpToolDefinition {
    /// Validate the flat string/integer schemas used by this catalog. Unsupported
    /// schema types fail closed; extend validation before adding new input types.
    pub fn validate_arguments(&self, args: &Value) -> Result<(), &'static str> {
        let args = args.as_object().ok_or("Arguments must be an object.")?;
        let properties = self.input_schema["properties"].as_object()
            .ok_or("Tool schema is unavailable.")?;
        if let Some(required) = self.input_schema["required"].as_array() {
            for name in required {
                if !name.as_str().is_some_and(|name| args.contains_key(name)) {
                    return Err("A required argument is missing.");
                }
            }
        }
        for (name, value) in args {
            let schema = properties.get(name).ok_or("Unknown argument.")?;
            match schema["type"].as_str() {
                Some("string") => {
                    let value = value.as_str().ok_or("Argument must be a string.")?;
                    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
                        return Err("String argument is empty, oversized, or contains control characters.");
                    }
                }
                Some("integer") => {
                    let value = value.as_i64().ok_or("Argument must be an integer.")?;
                    if name == "lines" && !(1..=1000).contains(&value) {
                        return Err("Log line count must be between 1 and 1000.");
                    }
                }
                _ => return Err("Unsupported argument schema."),
            }
        }
        Ok(())
    }
}

pub fn get_kyvon_mcp_tools() -> Vec<McpToolDefinition> {
    vec![
        // 1. Server Tools
        McpToolDefinition {
            name: "kyvon_server_list".into(),
            description: "List all monitored VPS hosts with their connectivity status, OS, and provider tags.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "tag": { "type": "string", "description": "Filter by tag (e.g. production, staging)" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_server_get".into(),
            description: "Retrieve complete hardware, OS matrix, and digital twin profile of a VPS.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_server_health".into(),
            description: "Get real-time CPU, RAM, disk, network, and load average telemetry for a server.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_server_capacity".into(),
            description: "Calculate capacity headroom, projected saturation days, and multi-signal outage risk score (0-100).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },

        // 2. Site & Nginx Tools
        McpToolDefinition {
            name: "kyvon_site_list".into(),
            description: "List all websites and domains hosted on the VPS with their upstream bindings and health status.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_site_get".into(),
            description: "Retrieve site configuration, SSL certificate validity, and reverse proxy mapping for a domain.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "domain"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "domain": { "type": "string", "description": "Fully qualified domain name (e.g. api.example.com)" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_site_metrics".into(),
            description: "Get site-level resource attribution (CPU %, RAM MB, disk I/O, error rate, connections).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "domain"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "domain": { "type": "string", "description": "Domain name" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_site_logs".into(),
            description: "Retrieve categorized access and error log entries for a domain with 4xx/5xx error extraction.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "domain"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "domain": { "type": "string", "description": "Domain name" },
                    "lines": { "type": "integer", "minimum": 1, "maximum": 1000, "default": 50, "description": "Number of log lines to inspect" }
                }
            }),
            is_read_only: true,
        },

        // 3. Diagnostics & Topology Tools
        McpToolDefinition {
            name: "kyvon_diagnose_site".into(),
            description: "Execute deep diagnostic pipeline investigating why a site is slow (DNS -> TLS -> Nginx -> Backend -> DB -> External API).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "domain"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "domain": { "type": "string", "description": "Domain name to diagnose" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_topology_get".into(),
            description: "Retrieve full causal relationship graph (Domain -> Nginx -> Container/Pod -> PID -> Database).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_incident_list".into(),
            description: "List active and historical incidents with timeline, causal root cause, and blast radius.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: true,
        },
        McpToolDefinition {
            name: "kyvon_changes_list".into(),
            description: "Answer 'What changed on production?' by returning correlated deployments, config drifts, and resource anomalies.".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "timeframe": { "type": "string", "default": "today", "description": "Time window (e.g. today, last 6h)" }
                }
            }),
            is_read_only: true,
        },

        // 4. Controlled Operation Write Tools (Risk-gated)
        McpToolDefinition {
            name: "kyvon_reload_nginx".into(),
            description: "Safely test Nginx configuration (nginx -t) and reload without connection termination (Risk: Low).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" }
                }
            }),
            is_read_only: false,
        },
        McpToolDefinition {
            name: "kyvon_restart_service".into(),
            description: "Restart a systemd or container service with preflight validation and impact assessment (Risk: Guarded/Elevated).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "service_name"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "service_name": { "type": "string", "description": "Name of the service (e.g. nginx, redis)" }
                }
            }),
            is_read_only: false,
        },
        McpToolDefinition {
            name: "kyvon_restart_container".into(),
            description: "Restart a specific Docker container with healthcheck verification (Risk: Guarded/Elevated).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "container_id"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "container_id": { "type": "string", "description": "Container ID or name" }
                }
            }),
            is_read_only: false,
        },
        McpToolDefinition {
            name: "kyvon_deploy".into(),
            description: "Deploy an application version or git commit with preflight checks and smoke tests (Risk: Elevated).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "application", "version"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "application": { "type": "string", "description": "Application name" },
                    "version": { "type": "string", "description": "Version tag or git commit hash" },
                    "environment": { "type": "string", "default": "production" }
                }
            }),
            is_read_only: false,
        },
        McpToolDefinition {
            name: "kyvon_rollback".into(),
            description: "Rollback an application to its previously healthy deployment record (Risk: Elevated).".into(),
            input_schema: json!({
                "type": "object",
                "required": ["server_id", "application"],
                "properties": {
                    "server_id": { "type": "string", "description": "Server identifier" },
                    "application": { "type": "string", "description": "Application name" }
                }
            }),
            is_read_only: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_catalog_has_complete_suite() {
        let tools = get_kyvon_mcp_tools();
        assert!(tools.len() >= 15);
        assert!(tools.iter().any(|t| t.name == "kyvon_diagnose_site"));
        assert!(tools.iter().any(|t| t.name == "kyvon_topology_get"));
        assert!(tools.iter().any(|t| t.name == "kyvon_changes_list"));
    }

    #[test]
    fn rejects_unbounded_logs_and_undeclared_arguments() {
        let tools = get_kyvon_mcp_tools();
        let tool = tools.iter().find(|t| t.name == "kyvon_site_logs").unwrap();
        for lines in [json!(0), json!(-1), json!(1001), json!(1.5), json!("50")] {
            assert!(tool.validate_arguments(&json!({"server_id": "s", "domain": "example.com", "lines": lines})).is_err());
        }
        assert!(tool.validate_arguments(&json!({"server_id": "s", "domain": "example.com", "lines": 1000})).is_ok());
        assert!(tool.validate_arguments(&json!({"server_id": "s", "domain": "example.com", "command": "id"})).is_err());
    }
}
