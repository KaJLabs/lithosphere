use std::process::ExitCode;
use std::time::Instant;

use litho_pq_conformance::{
    run_keygen_kats, verify, ML_DSA_65, ML_DSA_87, PROFILES, SLH_DSA_SHAKE_256S,
};
use ml_dsa::{Keypair, MlDsa65, MlDsa87, SignatureEncoding, SigningKey as MlSigningKey};
use slh_dsa::{Shake256s, SigningKey as SlhSigningKey, VerifyingKey as SlhVerifyingKey};

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
    let ml65 = benchmark_ml65()?;
    let ml87 = benchmark_ml87()?;
    let slh = benchmark_slh()?;
    println!(
        "{{\"schema\":1,\"scope\":\"non-consensus-makalu-candidate\",\"architecture\":\"{}\",\"os\":\"{}\",\"total_ms\":{},\"profiles\":[{ml65},{ml87},{slh}]}}",
        std::env::consts::ARCH,
        std::env::consts::OS,
        started.elapsed().as_millis()
    );
    Ok(())
}

fn benchmark_ml65() -> Result<String, String> {
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
    Ok(format!(
        "{{\"id\":257,\"name\":\"{}\",\"public_key_bytes\":{},\"signature_bytes\":{},\"keygen_us\":{keygen_us},\"sign_us\":{sign_us},\"verify_us\":{}}}",
        ML_DSA_65.name,
        ML_DSA_65.public_key_len,
        ML_DSA_65.signature_len,
        verification.elapsed().as_micros()
    ))
}

fn benchmark_ml87() -> Result<String, String> {
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
    Ok(format!(
        "{{\"id\":258,\"name\":\"{}\",\"public_key_bytes\":{},\"signature_bytes\":{},\"keygen_us\":{keygen_us},\"sign_us\":{sign_us},\"verify_us\":{}}}",
        ML_DSA_87.name,
        ML_DSA_87.public_key_len,
        ML_DSA_87.signature_len,
        verification.elapsed().as_micros()
    ))
}

fn benchmark_slh() -> Result<String, String> {
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
    Ok(format!(
        "{{\"id\":513,\"name\":\"{}\",\"public_key_bytes\":{},\"signature_bytes\":{},\"keygen_us\":{keygen_us},\"sign_us\":{sign_us},\"verify_us\":{}}}",
        SLH_DSA_SHAKE_256S.name,
        SLH_DSA_SHAKE_256S.public_key_len,
        SLH_DSA_SHAKE_256S.signature_len,
        verification.elapsed().as_micros()
    ))
}
