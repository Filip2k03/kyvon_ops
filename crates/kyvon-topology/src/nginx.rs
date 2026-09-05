use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NginxServerBlock {
    pub server_names: Vec<String>,
    pub listen_ports: Vec<u16>,
    pub is_ssl: bool,
    pub ssl_certificate: Option<String>,
    pub ssl_certificate_key: Option<String>,
    pub proxy_passes: Vec<String>, // e.g. "http://127.0.0.1:3000", "http://app_upstream"
    pub root_path: Option<String>,
    pub access_log: Option<String>,
    pub error_log: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NginxUpstream {
    pub name: String,
    pub servers: Vec<String>, // e.g. "127.0.0.1:8080", "unix:/tmp/app.sock"
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct NginxConfigDump {
    pub version: Option<String>,
    pub server_blocks: Vec<NginxServerBlock>,
    pub upstreams: Vec<NginxUpstream>,
}

pub fn parse_nginx_config(config_text: &str) -> NginxConfigDump {
    let mut dump = NginxConfigDump::default();
    let mut current_block: Option<NginxServerBlock> = None;
    let mut current_upstream: Option<NginxUpstream> = None;
    let mut in_server = false;
    let mut in_upstream = false;
    let mut brace_depth = 0;

    for raw_line in config_text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Upstream block detection
        if line.starts_with("upstream ") && line.ends_with('{') {
            let name = line
                .trim_start_matches("upstream ")
                .trim_end_matches('{')
                .trim()
                .to_string();
            current_upstream = Some(NginxUpstream {
                name,
                servers: Vec::new(),
            });
            in_upstream = true;
            continue;
        }

        if in_upstream {
            if line == "}" {
                if let Some(up) = current_upstream.take() {
                    dump.upstreams.push(up);
                }
                in_upstream = false;
                continue;
            }
            if line.starts_with("server ") {
                let target = line
                    .trim_start_matches("server ")
                    .trim_end_matches(';')
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();
                if !target.is_empty() {
                    if let Some(ref mut up) = current_upstream {
                        up.servers.push(target);
                    }
                }
            }
            continue;
        }

        // Server block detection
        if (line.starts_with("server {") || line == "server") && !in_server {
            in_server = true;
            brace_depth = 1;
            current_block = Some(NginxServerBlock {
                server_names: Vec::new(),
                listen_ports: Vec::new(),
                is_ssl: false,
                ssl_certificate: None,
                ssl_certificate_key: None,
                proxy_passes: Vec::new(),
                root_path: None,
                access_log: None,
                error_log: None,
            });
            continue;
        }

        if in_server {
            // Count open/close braces to correctly handle nested location blocks
            let opens = line.matches('{').count();
            let closes = line.matches('}').count();
            brace_depth = brace_depth + opens - closes;

            if brace_depth == 0 {
                if let Some(block) = current_block.take() {
                    dump.server_blocks.push(block);
                }
                in_server = false;
                continue;
            }

            if let Some(ref mut block) = current_block {
                let clean = line.trim_end_matches(';').trim();
                let mut parts = clean.split_whitespace();
                let directive = parts.next().unwrap_or("");

                match directive {
                    "server_name" => {
                        for name in parts {
                            let n = name.trim();
                            if !n.is_empty() && n != "_" {
                                block.server_names.push(n.to_string());
                            }
                        }
                    }
                    "listen" => {
                        let mut is_ssl = false;
                        let mut port = 80;
                        for part in parts {
                            if part == "ssl" {
                                is_ssl = true;
                            } else if let Ok(p) = part.parse::<u16>() {
                                port = p;
                            } else if let Some((_, p_str)) = part.rsplit_once(':') {
                                if let Ok(p) = p_str.parse::<u16>() {
                                    port = p;
                                }
                            }
                        }
                        block.listen_ports.push(port);
                        if is_ssl {
                            block.is_ssl = true;
                        }
                    }
                    "ssl_certificate" => {
                        if let Some(path) = parts.next() {
                            block.ssl_certificate = Some(path.to_string());
                            block.is_ssl = true;
                        }
                    }
                    "ssl_certificate_key" => {
                        if let Some(path) = parts.next() {
                            block.ssl_certificate_key = Some(path.to_string());
                        }
                    }
                    "proxy_pass" => {
                        if let Some(target) = parts.next() {
                            block.proxy_passes.push(target.to_string());
                        }
                    }
                    "root" => {
                        if let Some(path) = parts.next() {
                            block.root_path = Some(path.to_string());
                        }
                    }
                    "access_log" => {
                        if let Some(path) = parts.next() {
                            if path != "off" {
                                block.access_log = Some(path.to_string());
                            }
                        }
                    }
                    "error_log" => {
                        if let Some(path) = parts.next() {
                            block.error_log = Some(path.to_string());
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    dump
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_typical_nginx_vhost() {
        let conf = r#"
upstream shop_api_pool {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    access_log /var/log/nginx/example_access.log;
    error_log /var/log/nginx/example_error.log;

    location /api {
        proxy_pass http://shop_api_pool;
    }

    location / {
        root /var/www/html;
    }
}
        "#;

        let dump = parse_nginx_config(conf);
        assert_eq!(dump.upstreams.len(), 1);
        assert_eq!(dump.upstreams[0].name, "shop_api_pool");
        assert_eq!(dump.upstreams[0].servers.len(), 2);

        assert_eq!(dump.server_blocks.len(), 1);
        let s = &dump.server_blocks[0];
        assert_eq!(s.server_names, vec!["example.com", "www.example.com"]);
        assert!(s.is_ssl);
        assert!(s.listen_ports.contains(&80));
        assert!(s.listen_ports.contains(&443));
        assert_eq!(s.proxy_passes, vec!["http://shop_api_pool"]);
        assert_eq!(s.root_path.as_deref(), Some("/var/www/html"));
    }
}
