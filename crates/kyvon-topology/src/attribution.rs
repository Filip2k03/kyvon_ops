use kyvon_core::topology::{ResourceConsumer, VpsResourceBreakdown};

pub fn calculate_resource_breakdown(
    total_cpu_pct: f64,
    consumers: &[ResourceConsumer],
) -> VpsResourceBreakdown {
    let mut apps_pct = 0.0;
    let mut dbs_pct = 0.0;
    let mut docker_pct = 0.0;
    let mut nginx_pct = 0.0;
    let mut system_pct = 0.0;

    for c in consumers {
        match c.kind.as_str() {
            "application" | "app" | "node" | "python" | "php" | "go" | "rust" | "java" => {
                apps_pct += c.percentage;
            }
            "database" | "postgres" | "postgresql" | "mysql" | "mariadb" | "redis" | "mongodb" => {
                dbs_pct += c.percentage;
            }
            "docker" | "containerd" => {
                docker_pct += c.percentage;
            }
            "nginx" | "caddy" | "apache" | "traefik" => {
                nginx_pct += c.percentage;
            }
            "system" | "kernel" | "systemd" => {
                system_pct += c.percentage;
            }
            _ => {
                apps_pct += c.percentage;
            }
        }
    }

    let classified = apps_pct + dbs_pct + docker_pct + nginx_pct + system_pct;
    let other_pct = (total_cpu_pct - classified).max(0.0);

    let mut sorted_consumers = consumers.to_vec();
    sorted_consumers.sort_by(|a, b| {
        b.percentage
            .partial_cmp(&a.percentage)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    VpsResourceBreakdown {
        total_cpu_pct,
        applications_pct: apps_pct,
        databases_pct: dbs_pct,
        docker_pct,
        nginx_pct,
        system_pct,
        other_pct,
        top_consumers: sorted_consumers,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_proportions_properly() {
        let consumers = vec![
            ResourceConsumer {
                name: "shop-api".into(),
                kind: "application".into(),
                percentage: 21.0,
                container: Some("shop-api-prod".into()),
                pid: Some(18342),
                memory_mb: Some(1800.0),
            },
            ResourceConsumer {
                name: "wordpress".into(),
                kind: "application".into(),
                percentage: 18.0,
                container: None,
                pid: Some(19231),
                memory_mb: Some(600.0),
            },
            ResourceConsumer {
                name: "postgres".into(),
                kind: "database".into(),
                percentage: 11.0,
                container: None,
                pid: Some(2010),
                memory_mb: Some(2400.0),
            },
            ResourceConsumer {
                name: "nginx".into(),
                kind: "nginx".into(),
                percentage: 4.0,
                container: None,
                pid: Some(1040),
                memory_mb: Some(120.0),
            },
        ];

        let breakdown = calculate_resource_breakdown(72.0, &consumers);
        assert_eq!(breakdown.total_cpu_pct, 72.0);
        assert_eq!(breakdown.applications_pct, 39.0);
        assert_eq!(breakdown.databases_pct, 11.0);
        assert_eq!(breakdown.nginx_pct, 4.0);
        assert_eq!(breakdown.top_consumers[0].name, "shop-api");
    }
}
