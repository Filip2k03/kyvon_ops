//! Downsampling raw samples into the retention tiers of specification §40.
//!
//! Raw telemetry at one sample per second is 86,400 rows per metric per day
//! per server. Keeping that indefinitely would make the local database grow
//! without bound and the historical charts slow, so older data is folded into
//! buckets. The p95 is kept alongside the mean because a mean alone hides
//! exactly the spikes an operator is looking for.

use kyvon_core::{MetricAggregate, Resolution, TimestampMs};

/// Round a timestamp down to the start of its bucket.
pub fn bucket_start(ts: TimestampMs, resolution: Resolution) -> TimestampMs {
    let width = resolution.bucket_ms();
    if width <= 0 {
        return ts;
    }
    ts - ts.rem_euclid(width)
}

/// Fold a set of `(timestamp, value)` samples into buckets.
///
/// Input need not be sorted. Buckets with no samples are absent from the
/// result rather than being filled with zeros, so a gap in collection reads as
/// a gap in the chart instead of as a period of zero load.
pub fn downsample(
    samples: &[(TimestampMs, f64)],
    resolution: Resolution,
) -> Vec<MetricAggregate> {
    use std::collections::BTreeMap;

    let mut buckets: BTreeMap<TimestampMs, Vec<f64>> = BTreeMap::new();
    for (ts, v) in samples {
        if v.is_nan() {
            continue;
        }
        buckets.entry(bucket_start(*ts, resolution)).or_default().push(*v);
    }

    buckets
        .into_iter()
        .map(|(start, mut values)| {
            values.sort_by(|a, b| a.partial_cmp(b).expect("NaN filtered above"));
            MetricAggregate {
                bucket_start_ms: start,
                avg: values.iter().sum::<f64>() / values.len() as f64,
                min: values[0],
                max: values[values.len() - 1],
                p95: percentile(&values, 0.95),
                samples: values.len() as u32,
            }
        })
        .collect()
}

/// Nearest-rank percentile over a sorted slice.
///
/// Nearest-rank is used rather than interpolation because these are observed
/// measurements: reporting a p95 of 82.4% when no sample was ever 82.4% would
/// be presenting a number the host never produced.
pub fn percentile(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let rank = (q * sorted.len() as f64).ceil().max(1.0) as usize;
    sorted[rank.min(sorted.len()) - 1]
}

/// The cutoff before which samples at this resolution may be discarded.
pub fn retention_cutoff(now: TimestampMs, resolution: Resolution) -> TimestampMs {
    now - resolution.retention_ms()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buckets_align_to_the_resolution() {
        assert_eq!(bucket_start(1_770_000_061_500, Resolution::OneMinute), 1_770_000_060_000);
        assert_eq!(bucket_start(1_770_000_061_500, Resolution::Hourly), 1_769_997_600_000);
    }

    #[test]
    fn folds_samples_into_one_bucket_per_minute() {
        let samples: Vec<(TimestampMs, f64)> = (0..120)
            .map(|i| (1_770_000_000_000 + i * 1000, i as f64))
            .collect();
        let out = downsample(&samples, Resolution::OneMinute);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].samples, 60);
        assert_eq!(out[0].min, 0.0);
        assert_eq!(out[0].max, 59.0);
        assert!((out[0].avg - 29.5).abs() < 1e-9);
    }

    #[test]
    fn gaps_stay_gaps() {
        // Two samples an hour apart: two buckets, not sixty filled with zeros.
        let samples = vec![(0, 10.0), (3_600_000, 20.0)];
        let out = downsample(&samples, Resolution::OneMinute);
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn p95_is_an_observed_value() {
        let mut v: Vec<f64> = (1..=100).map(|i| i as f64).collect();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert_eq!(percentile(&v, 0.95), 95.0);
        assert_eq!(percentile(&v, 1.0), 100.0);
        assert_eq!(percentile(&[42.0], 0.95), 42.0);
        assert_eq!(percentile(&[], 0.5), 0.0);
    }

    #[test]
    fn a_spike_survives_downsampling() {
        // 59 quiet seconds and one saturated one: the average hides it, the
        // maximum does not, which is why both are stored.
        let mut samples: Vec<(TimestampMs, f64)> =
            (0..59).map(|i| (i * 1000, 5.0)).collect();
        samples.push((59_000, 99.0));
        let out = downsample(&samples, Resolution::OneMinute);
        assert_eq!(out.len(), 1);
        assert!(out[0].avg < 7.0);
        assert_eq!(out[0].max, 99.0);
    }

    #[test]
    fn resolution_is_chosen_to_keep_charts_readable() {
        assert_eq!(Resolution::for_window(300_000), Resolution::Raw);
        assert_eq!(Resolution::for_window(6 * 3_600_000), Resolution::OneMinute);
        assert_eq!(Resolution::for_window(7 * 24 * 3_600_000), Resolution::FiveMinute);
        assert_eq!(Resolution::for_window(30 * 24 * 3_600_000), Resolution::Hourly);
    }
}
