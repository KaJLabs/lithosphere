use std::process::ExitCode;
use std::time::Instant;

use litho_pq_conformance::{
    run_keygen_kats, verify, ML_DSA_65, ML_DSA_87, PROFILES, SLH_DSA_SHAKE_256S,
};
use ml_dsa::{Keypair, MlDsa65, MlDsa87, SignatureEncoding, SigningKey as MlSigningKey};
use slh_dsa::{Shake256s, SigningKey as SlhSigningKey, VerifyingKey as SlhVerifyingKey};

const BENCHMARK_TRIALS: usize = 32;
const BENCHMARK_WARMUPS: usize = 1;

#[derive(Clone, Copy, Debug)]
struct BenchmarkSample {
    keygen_us: u128,
    sign_us: u128,
    verify_us: u128,
}

#[derive(Debug, PartialEq)]
struct TimingStatistics {
    samples_us: Vec<u128>,
    mean_us: f64,
    median_us: f64,
    p95_us: u128,
    min_us: u128,
    max_us: u128,
}

impl TimingStatistics {
    fn from_samples(samples_us: Vec<u128>) -> Self {
        assert!(
            !samples_us.is_empty(),
            "benchmark samples must not be empty"
        );
        let mut ordered = samples_us.clone();
        ordered.sort_unstable();
        let count = ordered.len();
        let mean_us = ordered.iter().sum::<u128>() as f64 / count as f64;
        let midpoint = count / 2;
        let median_us = if count.is_multiple_of(2) {
            (ordered[midpoint - 1] as f64 + ordered[midpoint] as f64) / 2.0
        } else {
            ordered[midpoint] as f64
        };
        let p95_index = (count * 95).div_ceil(100) - 1;

        Self {
            samples_us,
            mean_us,
            median_us,
            p95_us: ordered[p95_index],
            min_us: ordered[0],
            max_us: ordered[count - 1],
        }
    }

    fn to_json(&self) -> String {
        let samples = self
            .samples_us
            .iter()
            .map(u128::to_string)
            .collect::<Vec<_>>()
            .join(",");
        format!(
            "{{\"samples_us\":[{samples}],\"mean_us\":{:.3},\"median_us\":{:.3},\"p95_us\":{},\"min_us\":{},\"max_us\":{}}}",
            self.mean_us, self.median_us, self.p95_us, self.min_us, self.max_us
        )
    }
}

fn main() -> ExitCode {
    match std::env::args().nth(1).as_deref() {
        Some("profiles") => {
            print_profiles();
            ExitCode::SUCCESS
        }
        Some("self-test") => match self_test() {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("self-test failed: {error}");
                ExitCode::FAILURE
            }
        },
        Some("benchmark") => match benchmark() {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("benchmark failed: {error}");
                ExitCode::FAILURE
            }
        },
        _ => {
            eprintln!("usage: litho-pq-conformance <profiles|self-test|benchmark>");
            ExitCode::from(2)
        }
    }
}

fn print_profiles() {
    for profile in PROFILES {
        println!(
            "0x{:04x} {} public_key={} signature={} context={}",
            profile.id,
            profile.name,
            profile.public_key_len,
            profile.signature_len,
            String::from_utf8_lossy(profile.context)
        );
    }
}

fn self_test() -> Result<(), String> {
    for result in run_keygen_kats() {
        if !result.passed {
            return Err(format!(
                "NIST keygen KAT {} case {}",
                result.profile, result.test_case
            ));
        }
    }

    round_trip_ml65()?;
    round_trip_ml87()?;
    round_trip_slh()?;
    println!("PASS: 3 NIST keygen KATs and 3 context-bound round trips");
    println!("SCOPE: non-consensus, disabled, Makalu-only candidate");
    Ok(())
}

fn round_trip_ml65() -> Result<(), String> {
    let sk = MlSigningKey::<MlDsa65>::from_seed(&[0x65_u8; 32].into());
    let message = b"LITHO PQ Phase 1 ML-DSA-65";
    let signature = sk
        .expanded_key()
        .sign_deterministic(message, ML_DSA_65.context)
        .map_err(|_| "ML-DSA-65 sign".to_owned())?
        .to_bytes();
    verify(
        ML_DSA_65.id,
        &sk.verifying_key().encode(),
        message,
        &signature,
    )
    .map_err(|error| format!("ML-DSA-65 verify: {error:?}"))
}

fn round_trip_ml87() -> Result<(), String> {
    let sk = MlSigningKey::<MlDsa87>::from_seed(&[0x87_u8; 32].into());
    let message = b"LITHO PQ Phase 1 ML-DSA-87";
    let signature = sk
        .expanded_key()
        .sign_deterministic(message, ML_DSA_87.context)
        .map_err(|_| "ML-DSA-87 sign".to_owned())?
        .to_bytes();
    verify(
        ML_DSA_87.id,
        &sk.verifying_key().encode(),
        message,
        &signature,
    )
    .map_err(|error| format!("ML-DSA-87 verify: {error:?}"))
}

fn round_trip_slh() -> Result<(), String> {
    let sk = SlhSigningKey::<Shake256s>::slh_keygen_internal(&[0x11; 32], &[0x22; 32], &[0x33; 32]);
    let message = b"LITHO PQ Phase 1 SLH-DSA-SHAKE-256s";
    let signature = sk
        .try_sign_with_context(message, SLH_DSA_SHAKE_256S.context, Some(&[0x44; 32]))
        .map_err(|_| "SLH-DSA sign".to_owned())?
        .to_bytes();
    let public_key =
        <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&sk).to_bytes();
    verify(SLH_DSA_SHAKE_256S.id, &public_key, message, &signature)
        .map_err(|error| format!("SLH-DSA verify: {error:?}"))
}

fn benchmark() -> Result<(), String> {
    let started = Instant::now();
    for _ in 0..BENCHMARK_WARMUPS {
        benchmark_ml65()?;
        benchmark_ml87()?;
        benchmark_slh()?;
    }
    let ml65 = collect_benchmark_samples(benchmark_ml65)?;
    let ml87 = collect_benchmark_samples(benchmark_ml87)?;
    let slh = collect_benchmark_samples(benchmark_slh)?;
    let ml65 = profile_benchmark_json(
        ML_DSA_65.id,
        ML_DSA_65.name,
        ML_DSA_65.public_key_len,
        ML_DSA_65.signature_len,
        &ml65,
    );
    let ml87 = profile_benchmark_json(
        ML_DSA_87.id,
        ML_DSA_87.name,
        ML_DSA_87.public_key_len,
        ML_DSA_87.signature_len,
        &ml87,
    );
    let slh = profile_benchmark_json(
        SLH_DSA_SHAKE_256S.id,
        SLH_DSA_SHAKE_256S.name,
        SLH_DSA_SHAKE_256S.public_key_len,
        SLH_DSA_SHAKE_256S.signature_len,
        &slh,
    );
    println!(
        "{{\"schema\":2,\"scope\":\"non-consensus-makalu-candidate\",\"architecture\":\"{}\",\"os\":\"{}\",\"unit\":\"microseconds\",\"warmup_count\":{BENCHMARK_WARMUPS},\"sample_count\":{BENCHMARK_TRIALS},\"total_ms\":{},\"profiles\":[{ml65},{ml87},{slh}]}}",
        std::env::consts::ARCH,
        std::env::consts::OS,
        started.elapsed().as_millis()
    );
    Ok(())
}

fn collect_benchmark_samples(
    sample: fn() -> Result<BenchmarkSample, String>,
) -> Result<Vec<BenchmarkSample>, String> {
    (0..BENCHMARK_TRIALS).map(|_| sample()).collect()
}

fn profile_benchmark_json(
    id: u16,
    name: &str,
    public_key_bytes: usize,
    signature_bytes: usize,
    samples: &[BenchmarkSample],
) -> String {
    let keygen =
        TimingStatistics::from_samples(samples.iter().map(|sample| sample.keygen_us).collect());
    let sign =
        TimingStatistics::from_samples(samples.iter().map(|sample| sample.sign_us).collect());
    let verify =
        TimingStatistics::from_samples(samples.iter().map(|sample| sample.verify_us).collect());
    format!(
        "{{\"id\":{id},\"name\":\"{name}\",\"public_key_bytes\":{public_key_bytes},\"signature_bytes\":{signature_bytes},\"keygen\":{},\"sign\":{},\"verify\":{}}}",
        keygen.to_json(),
        sign.to_json(),
        verify.to_json()
    )
}

fn benchmark_ml65() -> Result<BenchmarkSample, String> {
    let keygen = Instant::now();
    let sk = MlSigningKey::<MlDsa65>::from_seed(&[0x65; 32].into());
    let keygen_us = keygen.elapsed().as_micros();
    let message = b"benchmark";
    let sign = Instant::now();
    let signature = sk
        .expanded_key()
        .sign_deterministic(message, ML_DSA_65.context)
        .map_err(|_| "ML-DSA-65 benchmark sign".to_owned())?
        .to_bytes();
    let sign_us = sign.elapsed().as_micros();
    let pk = sk.verifying_key().encode();
    let verification = Instant::now();
    verify(ML_DSA_65.id, &pk, message, &signature)
        .map_err(|error| format!("ML-DSA-65 benchmark verify: {error:?}"))?;
    Ok(BenchmarkSample {
        keygen_us,
        sign_us,
        verify_us: verification.elapsed().as_micros(),
    })
}

fn benchmark_ml87() -> Result<BenchmarkSample, String> {
    let keygen = Instant::now();
    let sk = MlSigningKey::<MlDsa87>::from_seed(&[0x87; 32].into());
    let keygen_us = keygen.elapsed().as_micros();
    let message = b"benchmark";
    let sign = Instant::now();
    let signature = sk
        .expanded_key()
        .sign_deterministic(message, ML_DSA_87.context)
        .map_err(|_| "ML-DSA-87 benchmark sign".to_owned())?
        .to_bytes();
    let sign_us = sign.elapsed().as_micros();
    let pk = sk.verifying_key().encode();
    let verification = Instant::now();
    verify(ML_DSA_87.id, &pk, message, &signature)
        .map_err(|error| format!("ML-DSA-87 benchmark verify: {error:?}"))?;
    Ok(BenchmarkSample {
        keygen_us,
        sign_us,
        verify_us: verification.elapsed().as_micros(),
    })
}

fn benchmark_slh() -> Result<BenchmarkSample, String> {
    let keygen = Instant::now();
    let sk = SlhSigningKey::<Shake256s>::slh_keygen_internal(&[0x11; 32], &[0x22; 32], &[0x33; 32]);
    let keygen_us = keygen.elapsed().as_micros();
    let message = b"benchmark";
    let sign = Instant::now();
    let signature = sk
        .try_sign_with_context(message, SLH_DSA_SHAKE_256S.context, Some(&[0x44; 32]))
        .map_err(|_| "SLH-DSA benchmark sign".to_owned())?
        .to_bytes();
    let sign_us = sign.elapsed().as_micros();
    let public_key =
        <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&sk).to_bytes();
    let verification = Instant::now();
    verify(SLH_DSA_SHAKE_256S.id, &public_key, message, &signature)
        .map_err(|error| format!("SLH-DSA benchmark verify: {error:?}"))?;
    Ok(BenchmarkSample {
        keygen_us,
        sign_us,
        verify_us: verification.elapsed().as_micros(),
    })
}

#[cfg(test)]
mod tests {
    use super::TimingStatistics;

    #[test]
    fn statistics_retain_samples_and_use_nearest_rank_p95() {
        let statistics = TimingStatistics::from_samples(vec![4, 1, 3, 2]);
        assert_eq!(statistics.samples_us, vec![4, 1, 3, 2]);
        assert_eq!(statistics.mean_us, 2.5);
        assert_eq!(statistics.median_us, 2.5);
        assert_eq!(statistics.p95_us, 4);
        assert_eq!(statistics.min_us, 1);
        assert_eq!(statistics.max_us, 4);
    }

    #[test]
    fn p95_excludes_the_maximum_for_thirty_two_samples() {
        let statistics = TimingStatistics::from_samples((1..=32).collect());
        assert_eq!(statistics.median_us, 16.5);
        assert_eq!(statistics.p95_us, 31);
    }
}
