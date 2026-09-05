use kyvon_core::deployment::DeploymentRecord;
use kyvon_core::incident::{WhatChangedItem, WhatChangedReport};

pub fn generate_what_changed_report(
    server_id: &str,
    timeframe: &str,
    deployments: &[DeploymentRecord],
    config_diffs: &[String],
    container_updates: &[String],
    ram_growth_pct: Option<f64>,
) -> WhatChangedReport {
    let mut changes = Vec::new();

    for d in deployments {
        changes.push(WhatChangedItem {
            category: "Deployments".into(),
            description: format!("{} v{} (commit {})", d.application, d.version, d.git_commit),
            is_anomalous: false,
        });
    }

    for diff in config_diffs {
        changes.push(WhatChangedItem {
            category: "Configuration".into(),
            description: diff.clone(),
            is_anomalous: true,
        });
    }

    for update in container_updates {
        changes.push(WhatChangedItem {
            category: "Containers".into(),
            description: update.clone(),
            is_anomalous: false,
        });
    }

    if let Some(ram_growth) = ram_growth_pct {
        if ram_growth > 15.0 {
            changes.push(WhatChangedItem {
                category: "Resources".into(),
                description: format!("RAM usage elevated +{:.1}% over baseline", ram_growth),
                is_anomalous: true,
            });
        }
    }

    WhatChangedReport {
        server_id: server_id.to_string(),
        timeframe: timeframe.to_string(),
        generated_at_ms: kyvon_core::now_ms(),
        changes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use kyvon_core::deployment::DeploymentStatus;

    #[test]
    fn generates_correlated_changes() {
        let deps = vec![DeploymentRecord {
            id: "dep-1".into(),
            server_id: "s1".into(),
            application: "shop-api".into(),
            environment: "Production".into(),
            version: "1.8.3".into(),
            git_commit: "a81d921".into(),
            git_branch: "main".into(),
            git_repo: None,
            deployed_at_ms: 1700000000000,
            duration_seconds: 48,
            status: DeploymentStatus::Healthy,
            instances: 3,
            cpu_pct: 21.0,
            ram_mb: 1800.0,
            error_rate_pct: 0.2,
            requests_per_min: 3200,
        }];

        let report = generate_what_changed_report("s1", "today", &deps, &["nginx.conf timeout modified".into()], &[], Some(22.0));
        assert_eq!(report.changes.len(), 3);
        assert!(report.changes.iter().any(|c| c.category == "Deployments"));
        assert!(report.changes.iter().any(|c| c.category == "Resources" && c.is_anomalous));
    }
}
