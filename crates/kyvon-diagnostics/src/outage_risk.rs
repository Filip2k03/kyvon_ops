use kyvon_core::diagnostics::{OutageRiskLevel, OutageRiskScore, RiskFactor};

#[derive(Debug, Clone, Default)]
pub struct RiskSignals {
    pub cpu_pct: f64,
    pub load_avg_5m: f64,
    pub cpu_cores: u32,
    pub mem_available_pct: f64,
    pub swap_used_pct: f64,
    pub swap_in_growth: bool,
    pub disk_used_pct: f64,
    pub disk_io_wait_pct: f64,
    pub db_connection_util_pct: Option<f64>,
    pub container_crash_count_10m: u32,
    pub oom_kill_count_1h: u32,
    pub http_5xx_rate_pct: Option<f64>,
    pub http_p95_latency_ms: Option<f64>,
    pub days_until_cert_expiry: Option<i64>,
    pub open_unexpected_ports: u32,
}

pub fn calculate_outage_risk(signals: &RiskSignals) -> OutageRiskScore {
    let mut factors = Vec::new();
    let mut total_score = 0;

    // 1. CPU Saturation
    let cores = signals.cpu_cores.max(1) as f64;
    let load_ratio = signals.load_avg_5m / cores;
    if signals.cpu_pct > 90.0 || load_ratio > 1.8 {
        factors.push(RiskFactor {
            name: "CPU Saturation".into(),
            score_impact: 18,
            current_value: format!("{:.1}% (load: {:.2})", signals.cpu_pct, signals.load_avg_5m),
            description: "High CPU utilization exceeding sustainable baseline headroom.".into(),
        });
        total_score += 18;
    } else if signals.cpu_pct > 80.0 || load_ratio > 1.3 {
        factors.push(RiskFactor {
            name: "CPU Pressure".into(),
            score_impact: 10,
            current_value: format!("{:.1}%", signals.cpu_pct),
            description: "Moderate CPU saturation detected.".into(),
        });
        total_score += 10;
    }

    // 2. RAM & Swap Pressure
    if signals.mem_available_pct < 8.0 || (signals.swap_used_pct > 70.0 && signals.swap_in_growth) {
        factors.push(RiskFactor {
            name: "Critical RAM Exhaustion".into(),
            score_impact: 18,
            current_value: format!("{:.1}% avail, {:.1}% swap", signals.mem_available_pct, signals.swap_used_pct),
            description: "System is in imminent risk of OOM termination.".into(),
        });
        total_score += 18;
    } else if signals.mem_available_pct < 15.0 {
        factors.push(RiskFactor {
            name: "RAM Pressure".into(),
            score_impact: 12,
            current_value: format!("{:.1}% available", signals.mem_available_pct),
            description: "Available buffer and cache memory below recommended threshold.".into(),
        });
        total_score += 12;
    }

    // 3. OOM Kills
    if signals.oom_kill_count_1h > 0 {
        factors.push(RiskFactor {
            name: "Kernel OOM Kills Detected".into(),
            score_impact: 25,
            current_value: format!("{} kills in 1h", signals.oom_kill_count_1h),
            description: "Kernel has actively killed processes due to memory starvation.".into(),
        });
        total_score += 25;
    }

    // 4. Container Crashes / Restarts
    if signals.container_crash_count_10m > 2 {
        factors.push(RiskFactor {
            name: "Frequent Container Crashes".into(),
            score_impact: 20,
            current_value: format!("{} restarts in 10m", signals.container_crash_count_10m),
            description: "Containers entering crash loops or exit code failures.".into(),
        });
        total_score += 20;
    } else if signals.container_crash_count_10m > 0 {
        factors.push(RiskFactor {
            name: "Container Restarting".into(),
            score_impact: 8,
            current_value: format!("{} restarts", signals.container_crash_count_10m),
            description: "Unplanned container restart detected.".into(),
        });
        total_score += 8;
    }

    // 5. Disk Space & I/O Wait
    if signals.disk_used_pct > 92.0 {
        factors.push(RiskFactor {
            name: "Critical Disk Space".into(),
            score_impact: 15,
            current_value: format!("{:.1}% full", signals.disk_used_pct),
            description: "Root or log partition near complete saturation.".into(),
        });
        total_score += 15;
    } else if signals.disk_used_pct > 82.0 {
        factors.push(RiskFactor {
            name: "Disk Capacity Warning".into(),
            score_impact: 8,
            current_value: format!("{:.1}% full", signals.disk_used_pct),
            description: "Storage capacity nearing warning ceiling.".into(),
        });
        total_score += 8;
    }

    // 6. Database Connection Pool Saturation
    if let Some(db_util) = signals.db_connection_util_pct {
        if db_util > 90.0 {
            factors.push(RiskFactor {
                name: "Database Connection Exhaustion".into(),
                score_impact: 15,
                current_value: format!("{:.1}% pool used", db_util),
                description: "Postgres/MySQL connection pool near max_connections limit.".into(),
            });
            total_score += 15;
        } else if db_util > 75.0 {
            factors.push(RiskFactor {
                name: "Database Pool Pressure".into(),
                score_impact: 8,
                current_value: format!("{:.1}% pool used", db_util),
                description: "Elevated connection pooling usage.".into(),
            });
            total_score += 8;
        }
    }

    // 7. HTTP Errors
    if let Some(err_rate) = signals.http_5xx_rate_pct {
        if err_rate > 3.0 {
            factors.push(RiskFactor {
                name: "Elevated HTTP 5xx Error Rate".into(),
                score_impact: 15,
                current_value: format!("{:.2}% errors", err_rate),
                description: "Web or API traffic suffering significant server-side failures.".into(),
            });
            total_score += 15;
        } else if err_rate > 1.0 {
            factors.push(RiskFactor {
                name: "Minor HTTP 5xx Errors".into(),
                score_impact: 6,
                current_value: format!("{:.2}% errors", err_rate),
                description: "Sporadic server error burst detected.".into(),
            });
            total_score += 6;
        }
    }

    // 8. TLS Expiry
    if let Some(days) = signals.days_until_cert_expiry {
        if days < 3 {
            factors.push(RiskFactor {
                name: "Imminent TLS Certificate Expiry".into(),
                score_impact: 15,
                current_value: format!("{} days remaining", days),
                description: "SSL/TLS cert expiring in under 72 hours.".into(),
            });
            total_score += 15;
        } else if days < 10 {
            factors.push(RiskFactor {
                name: "TLS Certificate Expiring Soon".into(),
                score_impact: 6,
                current_value: format!("{} days remaining", days),
                description: "SSL certificate renewal required.".into(),
            });
            total_score += 6;
        }
    }

    let clamped_score = total_score.min(100);

    let (level, recommendation) = match clamped_score {
        0..=35 => (
            OutageRiskLevel::Low,
            "Operating nominal. Ample resource headroom and zero critical saturation.".into(),
        ),
        36..=65 => (
            OutageRiskLevel::Moderate,
            "Elevated resource consumption detected. Review active consumers and connection pools.".into(),
        ),
        66..=80 => (
            OutageRiskLevel::High,
            "High risk of service degradation. Immediate attention recommended for top warning factors.".into(),
        ),
        _ => (
            OutageRiskLevel::Critical,
            "Critical availability emergency! Immediate intervention required to prevent total downtime.".into(),
        ),
    };

    OutageRiskScore {
        score: clamped_score,
        level,
        factors,
        recommendation,
        calculated_at_ms: kyvon_core::now_ms(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nominal_signals_produce_low_risk() {
        let signals = RiskSignals {
            cpu_pct: 25.0,
            load_avg_5m: 1.0,
            cpu_cores: 4,
            mem_available_pct: 60.0,
            swap_used_pct: 0.0,
            swap_in_growth: false,
            disk_used_pct: 45.0,
            disk_io_wait_pct: 0.5,
            db_connection_util_pct: Some(20.0),
            container_crash_count_10m: 0,
            oom_kill_count_1h: 0,
            http_5xx_rate_pct: Some(0.0),
            http_p95_latency_ms: Some(120.0),
            days_until_cert_expiry: Some(60),
            open_unexpected_ports: 0,
        };

        let res = calculate_outage_risk(&signals);
        assert!(res.score <= 35);
        assert_eq!(res.level, OutageRiskLevel::Low);
    }

    #[test]
    fn severe_signals_produce_critical_risk() {
        let signals = RiskSignals {
            cpu_pct: 95.0,
            load_avg_5m: 9.0,
            cpu_cores: 4,
            mem_available_pct: 4.0,
            swap_used_pct: 90.0,
            swap_in_growth: true,
            disk_used_pct: 94.0,
            disk_io_wait_pct: 12.0,
            db_connection_util_pct: Some(96.0),
            container_crash_count_10m: 5,
            oom_kill_count_1h: 2,
            http_5xx_rate_pct: Some(8.5),
            http_p95_latency_ms: Some(2400.0),
            days_until_cert_expiry: Some(1),
            open_unexpected_ports: 2,
        };

        let res = calculate_outage_risk(&signals);
        assert!(res.score >= 81);
        assert_eq!(res.level, OutageRiskLevel::Critical);
    }
}
