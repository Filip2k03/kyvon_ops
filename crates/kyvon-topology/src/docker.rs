use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContainerPortMapping {
    pub host_ip: String,
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DockerContainerInfo {
    pub id: String,
    pub names: Vec<String>,
    pub image: String,
    pub command: String,
    pub state: String,
    pub status: String,
    pub compose_project: Option<String>,
    pub compose_service: Option<String>,
    pub port_mappings: Vec<ContainerPortMapping>,
    pub pid: Option<u32>,
    pub cpu_pct: Option<f64>,
    pub memory_bytes: Option<u64>,
}

pub fn parse_docker_ps_json(ndjson: &str) -> Vec<DockerContainerInfo> {
    let mut containers = Vec::new();
    for line in ndjson.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // We handle both docker ps standard json and full inspect entries
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            let id = val.get("ID")
                .or_else(|| val.get("Id"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if id.is_empty() {
                continue;
            }

            let names_str = val.get("Names").and_then(|v| v.as_str()).unwrap_or("");
            let names: Vec<String> = if !names_str.is_empty() {
                names_str.split(',').map(|s| s.trim().trim_start_matches('/').to_string()).collect()
            } else if let Some(arr) = val.get("Names").and_then(|v| v.as_array()) {
                arr.iter().filter_map(|v| v.as_str().map(|s| s.trim_start_matches('/').to_string())).collect()
            } else {
                vec![]
            };

            let image = val.get("Image").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let command = val.get("Command").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let state = val.get("State").and_then(|v| v.as_str()).unwrap_or("running").to_string();
            let status = val.get("Status").and_then(|v| v.as_str()).unwrap_or("").to_string();

            // Labels for Compose
            let labels = val.get("Labels");
            let compose_project = labels
                .and_then(|l| l.get("com.docker.compose.project"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let compose_service = labels
                .and_then(|l| l.get("com.docker.compose.service"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Parse ports: "0.0.0.0:3000->3000/tcp, :::3000->3000/tcp"
            let ports_raw = val.get("Ports").and_then(|v| v.as_str()).unwrap_or("");
            let port_mappings = parse_ports_field(ports_raw);

            containers.push(DockerContainerInfo {
                id,
                names,
                image,
                command,
                state,
                status,
                compose_project,
                compose_service,
                port_mappings,
                pid: None,
                cpu_pct: None,
                memory_bytes: None,
            });
        }
    }
    containers
}

fn parse_ports_field(ports_str: &str) -> Vec<ContainerPortMapping> {
    let mut mappings = Vec::new();
    for part in ports_str.split(',') {
        let p = part.trim();
        // format: 0.0.0.0:8080->80/tcp or 80/tcp
        if let Some((host_side, container_side)) = p.split_once("->") {
            let (host_ip, host_port_str) = host_side.rsplit_once(':').unwrap_or(("0.0.0.0", host_side));
            let (container_port_str, proto) = container_side.split_once('/').unwrap_or((container_side, "tcp"));

            if let (Ok(h_port), Ok(c_port)) = (host_port_str.parse::<u16>(), container_port_str.parse::<u16>()) {
                mappings.push(ContainerPortMapping {
                    host_ip: host_ip.to_string(),
                    host_port: h_port,
                    container_port: c_port,
                    protocol: proto.to_string(),
                });
            }
        }
    }
    mappings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_docker_ps_line() {
        let raw = r#"{"ID":"a1b2c3d4e5f6","Image":"node:22-alpine","Command":"docker-entrypoint.sh npm start","CreatedAt":"2026-09-01 12:00:00","RunningFor":"4 days","Ports":"0.0.0.0:3000->3000/tcp, :::3000->3000/tcp","Status":"Up 4 days","Size":"0B","Names":"shop-api","State":"running"}"#;
        let res = parse_docker_ps_json(raw);
        assert_eq!(res.len(), 1);
        let c = &res[0];
        assert_eq!(c.id, "a1b2c3d4e5f6");
        assert_eq!(c.names, vec!["shop-api"]);
        assert_eq!(c.port_mappings.len(), 2);
        assert_eq!(c.port_mappings[0].host_port, 3000);
        assert_eq!(c.port_mappings[0].container_port, 3000);
    }
}
