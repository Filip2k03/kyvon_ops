use kyvon_core::diagnostics::SitePerformanceReport;

#[derive(Debug, Clone)]
pub struct LatencyBreakdownSample {
    pub domain: String,
    pub dns_ms: f64,
    pub tls_ms: f64,
    pub nginx_ms: f64,
    pub backend_ms: f64,
    pub database_ms: f64,
    pub redis_ms: f64,
    pub external_api_ms: f64,
    pub observed_latencies_ms: Vec<f64>,
}

pub fn diagnose_site_performance(sample: &LatencyBreakdownSample) -> SitePerformanceReport {
    // Identify primary bottleneck by highest latency segment
    let mut segments = [
        ("DNS Resolution", sample.dns_ms),
        ("TLS Handshake", sample.tls_ms),
        ("Nginx Gateway", sample.nginx_ms),
        ("Backend Application", sample.backend_ms),
        ("Database Queries", sample.database_ms),
        ("Redis Cache", sample.redis_ms),
        ("External APIs", sample.external_api_ms),
    ];

    segments.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let primary_bottleneck = segments
        .first()
        .map(|s| s.0)
        .unwrap_or("Unknown")
        .to_string();

    // Calculate percentiles
    let mut sorted_latencies = sample.observed_latencies_ms.clone();
    sorted_latencies.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let avg_latency_ms = if sorted_latencies.is_empty() {
        sample.dns_ms
            + sample.tls_ms
            + sample.nginx_ms
            + sample.backend_ms
            + sample.database_ms
            + sample.external_api_ms
    } else {
        sorted_latencies.iter().sum::<f64>() / sorted_latencies.len() as f64
    };

    let p95_ms = if sorted_latencies.is_empty() {
        avg_latency_ms * 1.5
    } else {
        let idx = ((sorted_latencies.len() as f64 * 0.95).floor() as usize)
            .min(sorted_latencies.len() - 1);
        sorted_latencies[idx]
    };

    let p99_ms = if sorted_latencies.is_empty() {
        avg_latency_ms * 2.2
    } else {
        let idx = ((sorted_latencies.len() as f64 * 0.99).floor() as usize)
            .min(sorted_latencies.len() - 1);
        sorted_latencies[idx]
    };

    SitePerformanceReport {
        domain: sample.domain.clone(),
        dns_ms: sample.dns_ms,
        tls_ms: sample.tls_ms,
        nginx_ms: sample.nginx_ms,
        backend_ms: sample.backend_ms,
        database_ms: sample.database_ms,
        redis_ms: sample.redis_ms,
        external_api_ms: sample.external_api_ms,
        primary_bottleneck,
        avg_latency_ms: (avg_latency_ms * 10.0).round() / 10.0,
        p95_ms: (p95_ms * 10.0).round() / 10.0,
        p99_ms: (p99_ms * 10.0).round() / 10.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifies_external_api_bottleneck() {
        let sample = LatencyBreakdownSample {
            domain: "api.example.com".into(),
            dns_ms: 12.0,
            tls_ms: 31.0,
            nginx_ms: 4.0,
            backend_ms: 183.0,
            database_ms: 142.0,
            redis_ms: 2.0,
            external_api_ms: 480.0,
            observed_latencies_ms: vec![150.0, 220.0, 480.0, 850.0, 1200.0, 2700.0],
        };

        let report = diagnose_site_performance(&sample);
        assert_eq!(report.primary_bottleneck, "External APIs");
        assert!(report.p99_ms >= 2000.0);
    }
}
