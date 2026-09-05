use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PortBinding {
    pub port: u16,
    pub protocol: String,
    pub address: String, // e.g. "0.0.0.0", "127.0.0.1", "::"
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub is_world_exposed: bool,
}

pub fn index_port_bindings(sockets: &[PortBinding]) -> HashMap<u16, PortBinding> {
    let mut map = HashMap::new();
    for s in sockets {
        map.insert(s.port, s.clone());
    }
    map
}
