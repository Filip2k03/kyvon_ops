use crate::docker::DockerContainerInfo;
use crate::nginx::NginxConfigDump;
use crate::ports::PortBinding;
use kyvon_core::topology::{EdgeKind, NodeKind, TopologyEdge, TopologyGraph, TopologyNode};
use std::collections::HashMap;

pub struct TopologyBuilder {
    server_id: String,
    nodes: Vec<TopologyNode>,
    edges: Vec<TopologyEdge>,
    node_ids: HashMap<String, usize>,
}

impl TopologyBuilder {
    pub fn new(server_id: impl Into<String>) -> Self {
        Self {
            server_id: server_id.into(),
            nodes: Vec::new(),
            edges: Vec::new(),
            node_ids: HashMap::new(),
        }
    }

    pub fn add_node(
        &mut self,
        id: String,
        kind: NodeKind,
        label: String,
        metadata: HashMap<String, String>,
    ) {
        if !self.node_ids.contains_key(&id) {
            self.node_ids.insert(id.clone(), self.nodes.len());
            self.nodes.push(TopologyNode {
                id,
                kind,
                label,
                metadata,
            });
        }
    }

    pub fn add_edge(&mut self, from: String, to: String, kind: EdgeKind, label: Option<String>) {
        self.edges.push(TopologyEdge {
            from,
            to,
            kind,
            label,
        });
    }

    pub fn build(self) -> TopologyGraph {
        TopologyGraph {
            server_id: self.server_id,
            nodes: self.nodes,
            edges: self.edges,
            generated_at_ms: kyvon_core::now_ms(),
        }
    }
}

pub fn synthesize_topology(
    server_id: &str,
    nginx: Option<&NginxConfigDump>,
    containers: &[DockerContainerInfo],
    ports: &[PortBinding],
) -> TopologyGraph {
    let mut builder = TopologyBuilder::new(server_id);

    // 1. Port mapping & container lookup
    let mut port_to_container: HashMap<u16, &DockerContainerInfo> = HashMap::new();
    for c in containers {
        let container_node_id = format!("container:{}", c.id);
        let mut meta = HashMap::new();
        meta.insert("image".into(), c.image.clone());
        meta.insert("status".into(), c.status.clone());
        if let Some(ref svc) = c.compose_service {
            meta.insert("compose_service".into(), svc.clone());
        }

        builder.add_node(
            container_node_id.clone(),
            NodeKind::Container,
            c.names
                .first()
                .cloned()
                .unwrap_or_else(|| c.id[..12.min(c.id.len())].to_string()),
            meta,
        );

        for p in &c.port_mappings {
            port_to_container.insert(p.host_port, c);
            port_to_container.insert(p.container_port, c);
        }
    }

    // 2. Listening ports & processes
    let mut port_to_binding: HashMap<u16, &PortBinding> = HashMap::new();
    for p in ports {
        port_to_binding.insert(p.port, p);
        if let Some(pid) = p.pid {
            let proc_node_id = format!("pid:{}", pid);
            let mut meta = HashMap::new();
            if let Some(ref name) = p.process_name {
                meta.insert("process_name".into(), name.clone());
            }
            meta.insert("port".into(), p.port.to_string());
            builder.add_node(
                proc_node_id.clone(),
                NodeKind::Process,
                p.process_name
                    .clone()
                    .unwrap_or_else(|| format!("PID {}", pid)),
                meta,
            );

            // Connect container to process if port matches
            if let Some(c) = port_to_container.get(&p.port) {
                let container_node_id = format!("container:{}", c.id);
                builder.add_edge(
                    container_node_id,
                    proc_node_id,
                    EdgeKind::RunsIn,
                    Some("process".into()),
                );
            }
        }
    }

    // 3. Nginx Server Blocks and Domains
    if let Some(dump) = nginx {
        for (idx, block) in dump.server_blocks.iter().enumerate() {
            let block_id = format!("nginx_block:{}", idx);
            let mut meta = HashMap::new();
            meta.insert("ssl".into(), block.is_ssl.to_string());
            if let Some(ref cert) = block.ssl_certificate {
                meta.insert("ssl_certificate".into(), cert.clone());
            }

            builder.add_node(
                block_id.clone(),
                NodeKind::ServerBlock,
                format!(
                    "vhost:{}",
                    block
                        .server_names
                        .first()
                        .map(|s| s.as_str())
                        .unwrap_or("default")
                ),
                meta,
            );

            for domain in &block.server_names {
                let domain_id = format!("domain:{}", domain);
                let mut d_meta = HashMap::new();
                d_meta.insert("domain".into(), domain.clone());
                builder.add_node(domain_id.clone(), NodeKind::Domain, domain.clone(), d_meta);
                builder.add_edge(
                    domain_id,
                    block_id.clone(),
                    EdgeKind::ProxiesTo,
                    Some("reverse_proxy".into()),
                );
            }

            // Upstream proxying
            for proxy in &block.proxy_passes {
                // e.g. "http://127.0.0.1:3000" or "http://shop_pool"
                let target_cleaned = proxy
                    .trim_start_matches("http://")
                    .trim_start_matches("https://")
                    .trim_end_matches('/');

                if let Some((_, port_str)) = target_cleaned.split_once(':') {
                    if let Ok(port) = port_str.parse::<u16>() {
                        if let Some(c) = port_to_container.get(&port) {
                            let container_id = format!("container:{}", c.id);
                            builder.add_edge(
                                block_id.clone(),
                                container_id,
                                EdgeKind::ProxiesTo,
                                Some(format!("upstream port {}", port)),
                            );
                        } else if let Some(p) = port_to_binding.get(&port) {
                            if let Some(pid) = p.pid {
                                builder.add_edge(
                                    block_id.clone(),
                                    format!("pid:{}", pid),
                                    EdgeKind::ProxiesTo,
                                    Some(format!("upstream port {}", port)),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    builder.build()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docker::ContainerPortMapping;
    use crate::nginx::NginxServerBlock;

    #[test]
    fn synthesizes_full_graph() {
        let dump = NginxConfigDump {
            version: Some("1.26.0".into()),
            server_blocks: vec![NginxServerBlock {
                server_names: vec!["api.acme.com".into()],
                listen_ports: vec![80, 443],
                is_ssl: true,
                ssl_certificate: Some("/etc/ssl/cert.pem".into()),
                ssl_certificate_key: None,
                proxy_passes: vec!["http://127.0.0.1:3000".into()],
                root_path: None,
                access_log: None,
                error_log: None,
            }],
            upstreams: vec![],
        };

        let containers = vec![DockerContainerInfo {
            id: "cid-123".into(),
            names: vec!["acme-api".into()],
            image: "acme/api:1.0".into(),
            command: "npm start".into(),
            state: "running".into(),
            status: "Up 2 days".into(),
            compose_project: Some("acme".into()),
            compose_service: Some("api".into()),
            port_mappings: vec![ContainerPortMapping {
                host_ip: "127.0.0.1".into(),
                host_port: 3000,
                container_port: 3000,
                protocol: "tcp".into(),
            }],
            pid: Some(4242),
            cpu_pct: Some(15.2),
            memory_bytes: Some(512 * 1024 * 1024),
        }];

        let ports = vec![PortBinding {
            port: 3000,
            protocol: "tcp".into(),
            address: "127.0.0.1".into(),
            pid: Some(4242),
            process_name: Some("node".into()),
            is_world_exposed: false,
        }];

        let graph = synthesize_topology("srv-1", Some(&dump), &containers, &ports);
        assert_eq!(graph.server_id, "srv-1");
        assert!(graph.nodes.iter().any(|n| n.id == "domain:api.acme.com"));
        assert!(graph.nodes.iter().any(|n| n.id == "container:cid-123"));
        assert!(graph.nodes.iter().any(|n| n.id == "pid:4242"));
        assert!(graph.edges.len() >= 2);
    }
}
