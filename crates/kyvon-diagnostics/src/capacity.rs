use kyvon_core::diagnostics::{CapacityForecast, CapacityForecastPoint};

pub struct MetricTrendSample {
    pub timestamp_ms: i64,
    pub cpu_pct: f64,
    pub ram_pct: f64,
    pub disk_pct: f64,
}

pub fn predict_capacity(samples: &[MetricTrendSample]) -> CapacityForecast {
    if samples.is_empty() {
        return CapacityForecast {
            current_utilization_pct: 0.0,
            reserved_headroom_pct: 100.0,
            projected_saturation_days: None,
            points: vec![],
            bottleneck_resource: "None".into(),
        };
    }

    let latest = samples.last().unwrap();
    let current_util = latest.cpu_pct.max(latest.ram_pct).max(latest.disk_pct);
    let reserved_headroom = (100.0 - current_util).max(0.0);

    // Calculate growth slope if we have at least 2 samples separated by time
    let mut disk_slope_per_hour = 0.0;
    let mut ram_slope_per_hour = 0.0;
    let mut cpu_slope_per_hour = 0.0;

    if samples.len() >= 2 {
        let first = samples.first().unwrap();
        let delta_hours = ((latest.timestamp_ms - first.timestamp_ms) as f64 / 3_600_000.0).max(0.1);
        disk_slope_per_hour = (latest.disk_pct - first.disk_pct) / delta_hours;
        ram_slope_per_hour = (latest.ram_pct - first.ram_pct) / delta_hours;
        cpu_slope_per_hour = (latest.cpu_pct - first.cpu_pct) / delta_hours;
    }

    // Determine primary bottleneck resource
    let (bottleneck, max_slope, current_pct) = {
        if disk_slope_per_hour >= ram_slope_per_hour && disk_slope_per_hour >= cpu_slope_per_hour && disk_slope_per_hour > 0.0 {
            ("Disk", disk_slope_per_hour, latest.disk_pct)
        } else if ram_slope_per_hour >= cpu_slope_per_hour && ram_slope_per_hour > 0.0 {
            ("RAM", ram_slope_per_hour, latest.ram_pct)
        } else if cpu_slope_per_hour > 0.0 {
            ("CPU", cpu_slope_per_hour, latest.cpu_pct)
        } else {
            ("Stable", 0.0, current_util)
        }
    };

    let projected_saturation_days = if max_slope > 0.001 {
        let remaining_pct = (100.0 - current_pct).max(0.0);
        let hours_remaining = remaining_pct / max_slope;
        Some((hours_remaining / 24.0).max(0.1))
    } else {
        None
    };

    // Project forward points: +1h, +6h, +24h, +168h (7 days)
    let forecast_horizons = [1, 6, 24, 168];
    let mut points = Vec::new();

    for &h in &forecast_horizons {
        let p_cpu = (latest.cpu_pct + cpu_slope_per_hour * h as f64).clamp(0.0, 100.0);
        let p_ram = (latest.ram_pct + ram_slope_per_hour * h as f64).clamp(0.0, 100.0);
        let p_disk = (latest.disk_pct + disk_slope_per_hour * h as f64).clamp(0.0, 100.0);

        points.push(CapacityForecastPoint {
            hours_ahead: h,
            projected_cpu_pct: (p_cpu * 10.0).round() / 10.0,
            projected_ram_pct: (p_ram * 10.0).round() / 10.0,
            projected_disk_pct: (p_disk * 10.0).round() / 10.0,
        });
    }

    CapacityForecast {
        current_utilization_pct: (current_util * 10.0).round() / 10.0,
        reserved_headroom_pct: (reserved_headroom * 10.0).round() / 10.0,
        projected_saturation_days: projected_saturation_days.map(|d| (d * 10.0).round() / 10.0),
        points,
        bottleneck_resource: bottleneck.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn predicts_disk_saturation() {
        let now = 1700000000000i64;
        let samples = vec![
            MetricTrendSample {
                timestamp_ms: now - 24 * 3_600_000,
                cpu_pct: 40.0,
                ram_pct: 50.0,
                disk_pct: 70.0,
            },
            MetricTrendSample {
                timestamp_ms: now,
                cpu_pct: 42.0,
                ram_pct: 51.0,
                disk_pct: 76.0, // grew 6% over 24 hours = 0.25%/hour
            },
        ];

        let forecast = predict_capacity(&samples);
        assert_eq!(forecast.bottleneck_resource, "Disk");
        assert!(forecast.projected_saturation_days.is_some());
        // 24% remaining / 6% per day = 4 days
        let days = forecast.projected_saturation_days.unwrap();
        assert!((days - 4.0).abs() < 0.5);
    }
}
