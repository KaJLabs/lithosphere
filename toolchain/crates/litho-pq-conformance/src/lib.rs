//! Makalu-only, non-consensus conformance code for the frozen LITHO PQ profiles.

use ml_dsa::{Keypair, MlDsa65, MlDsa87, Signature as MlSignature, SigningKey as MlSigningKey};
use sha2::{Digest, Sha256};
use slh_dsa::{
    Shake256s, Signature as SlhSignature, SigningKey as SlhSigningKey,
    VerifyingKey as SlhVerifyingKey,
};

/// Frozen R9 profile metadata.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Profile {
    /// Consensus profile identifier reserved by the R9 design.
    pub id: u16,
    /// Exact frozen profile name.
    pub name: &'static str,
    /// FIPS context string.
    pub context: &'static [u8],
    /// Exact public-key length.
    pub public_key_len: usize,
    /// Exact signature length.
    pub signature_len: usize,
}

/// ML-DSA-65 ordinary authorization profile.
pub const ML_DSA_65: Profile = Profile {
    id: 0x0101,
    name: "ML_DSA_65_FIPS204_2024_CORR20260731_V1",
    context: b"LITHO-PQ-AUTH-V1",
    public_key_len: 1952,
    signature_len: 3309,
};

/// ML-DSA-87 successor authorization profile.
pub const ML_DSA_87: Profile = Profile {
    id: 0x0102,
    name: "ML_DSA_87_FIPS204_2024_CORR20260731_V1",
    context: b"LITHO-PQ-AUTH-V1",
    public_key_len: 2592,
    signature_len: 4627,
};

/// SLH-DSA-SHAKE-256s recovery profile.
pub const SLH_DSA_SHAKE_256S: Profile = Profile {
    id: 0x0201,
    name: "SLH_DSA_SHAKE_256S_FIPS205_2024_V1",
    context: b"LITHO-PQ-RECOVERY-V1",
    public_key_len: 64,
    signature_len: 29_792,
};

/// All signature profiles implemented by this isolated candidate.
pub const PROFILES: [Profile; 3] = [ML_DSA_65, ML_DSA_87, SLH_DSA_SHAKE_256S];

/// One deterministic known-answer result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KatResult {
    /// Frozen profile name.
    pub profile: &'static str,
    /// NIST ACVP test case number.
    pub test_case: u32,
    /// Whether both public and private encoded outputs matched.
    pub passed: bool,
}

/// Verification failures are intentionally coarse and deterministic.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VerifyError {
    /// The profile is unknown to this candidate.
    UnsupportedProfile,
    /// Public key or signature length is not the exact profile length.
    InvalidEncoding,
    /// The signature was well-sized but invalid.
    VerificationFailed,
}

/// Verify a signature with strict, allocation-bounded decoding.
pub fn verify(
    profile_id: u16,
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
) -> Result<(), VerifyError> {
    match profile_id {
        0x0101 => verify_ml65(public_key, message, signature),
        0x0102 => verify_ml87(public_key, message, signature),
        0x0201 => verify_slh(public_key, message, signature),
        _ => Err(VerifyError::UnsupportedProfile),
    }
}

fn verify_ml65(public_key: &[u8], message: &[u8], signature: &[u8]) -> Result<(), VerifyError> {
    let pk = public_key
        .try_into()
        .map_err(|_| VerifyError::InvalidEncoding)?;
    let sig = signature
        .try_into()
        .ok()
        .and_then(|encoded| MlSignature::<MlDsa65>::decode(&encoded))
        .ok_or(VerifyError::InvalidEncoding)?;
    let vk = ml_dsa::VerifyingKey::<MlDsa65>::decode(&pk);
    vk.verify_with_context(message, ML_DSA_65.context, &sig)
        .then_some(())
        .ok_or(VerifyError::VerificationFailed)
}

fn verify_ml87(public_key: &[u8], message: &[u8], signature: &[u8]) -> Result<(), VerifyError> {
    let pk = public_key
        .try_into()
        .map_err(|_| VerifyError::InvalidEncoding)?;
    let sig = signature
        .try_into()
        .ok()
        .and_then(|encoded| MlSignature::<MlDsa87>::decode(&encoded))
        .ok_or(VerifyError::InvalidEncoding)?;
    let vk = ml_dsa::VerifyingKey::<MlDsa87>::decode(&pk);
    vk.verify_with_context(message, ML_DSA_87.context, &sig)
        .then_some(())
        .ok_or(VerifyError::VerificationFailed)
}

fn verify_slh(public_key: &[u8], message: &[u8], signature: &[u8]) -> Result<(), VerifyError> {
    let vk = SlhVerifyingKey::<Shake256s>::try_from(public_key)
        .map_err(|_| VerifyError::InvalidEncoding)?;
    let sig =
        SlhSignature::<Shake256s>::try_from(signature).map_err(|_| VerifyError::InvalidEncoding)?;
    vk.try_verify_with_context(message, SLH_DSA_SHAKE_256S.context, &sig)
        .map_err(|_| VerifyError::VerificationFailed)
}

/// Execute the three reduced NIST ACVP key-generation KATs.
pub fn run_keygen_kats() -> [KatResult; 3] {
    [kat_ml65(), kat_ml87(), kat_slh()]
}

fn kat_ml65() -> KatResult {
    let seed = decode_32("A991FD42B071D49C48AE3E75C647459E0DAAD1E1BA356A04801912D3294BCFF8");
    let sk = MlSigningKey::<MlDsa65>::from_seed(&seed.into());
    #[allow(deprecated)]
    let expanded = sk.expanded_key().to_expanded();
    let pk = sk.verifying_key().encode();
    KatResult {
        profile: ML_DSA_65.name,
        test_case: 26,
        passed: sha256_hex(pk.as_slice())
            == "b1a7d0d2f0d7a04b9d5ffccd9bd578864dab4a01cdd7f70a05cd1f4f0672e43a"
            && sha256_hex(expanded.as_slice())
                == "56c53ac82fbff7d81b7a8cfbbc73011ceccad677e16dc53f2ece66d49aa11edd",
    }
}

fn kat_ml87() -> KatResult {
    let seed = decode_32("A16F5B0796703E2D1A0140A35CBF36EFABE70E752BA59B6A9A0E9C4B05302F73");
    let sk = MlSigningKey::<MlDsa87>::from_seed(&seed.into());
    #[allow(deprecated)]
    let expanded = sk.expanded_key().to_expanded();
    let pk = sk.verifying_key().encode();
    KatResult {
        profile: ML_DSA_87.name,
        test_case: 51,
        passed: sha256_hex(pk.as_slice())
            == "33f49649f05ec2fc3b050007b18ade043bbc8d1c0ded03a269d540486daaa5f4"
            && sha256_hex(expanded.as_slice())
                == "c64e15742f27d7d8e2832f7d55a5c014f2c9536082f3a3181cfc6246908dd649",
    }
}

fn kat_slh() -> KatResult {
    let sk_seed = decode_32("E440E39644A11A6A58E850C09C8F03C273E465237F3BEF7C58DE62281E676CEA");
    let sk_prf = decode_32("99C199C00DB30F8499A61B5B9DC8A361725F6AE80E97037176F408C30B38844D");
    let pk_seed = decode_32("D7B5E755B4879FDE3288A21AF3E32FBB006FD9B8BC2B180EB9B0D82C9F3157AF");
    let sk = SlhSigningKey::<Shake256s>::slh_keygen_internal(&sk_seed, &sk_prf, &pk_seed);
    let pk =
        <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&sk).to_bytes();
    let encoded_sk = sk.to_bytes();
    KatResult {
        profile: SLH_DSA_SHAKE_256S.name,
        test_case: 91,
        passed: sha256_hex(pk.as_slice())
            == "49a30ef4ed23a45399324c774fab8572e668f0266575c152783c8187395d9365"
            && sha256_hex(encoded_sk.as_slice())
                == "3411ecdfeac0db9c1bba94f9d3384e8ef0e82b08bdb373c71884e9a6348ae86d",
    }
}

fn decode_32(value: &str) -> [u8; 32] {
    assert_eq!(value.len(), 64);
    let mut out = [0_u8; 32];
    for (index, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .expect("embedded vector is valid hex");
    }
    out
}

fn sha256_hex(value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    let mut encoded = String::with_capacity(64);
    for byte in digest {
        use core::fmt::Write;
        write!(&mut encoded, "{byte:02x}").expect("writing to String cannot fail");
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;
    use ml_dsa::SignatureEncoding;

    #[test]
    fn frozen_profile_table_matches_r9() {
        assert_eq!(PROFILES.len(), 3);
        assert_eq!(ML_DSA_65.context.len(), 16);
        assert_eq!(ML_DSA_87.context, ML_DSA_65.context);
        assert_eq!(SLH_DSA_SHAKE_256S.context, b"LITHO-PQ-RECOVERY-V1");
    }

    #[test]
    fn official_keygen_kats_pass() {
        let results = run_keygen_kats();
        assert!(results.iter().all(|result| result.passed), "{results:#?}");
    }

    #[test]
    fn strict_decoder_rejects_unknown_and_wrong_lengths() {
        assert_eq!(
            verify(0xffff, &[], b"message", &[]),
            Err(VerifyError::UnsupportedProfile)
        );
        for profile in PROFILES {
            assert_eq!(
                verify(
                    profile.id,
                    &vec![0; profile.public_key_len.saturating_sub(1)],
                    b"message",
                    &vec![0; profile.signature_len]
                ),
                Err(VerifyError::InvalidEncoding)
            );
            assert_eq!(
                verify(
                    profile.id,
                    &vec![0; profile.public_key_len],
                    b"message",
                    &vec![0; profile.signature_len + 1]
                ),
                Err(VerifyError::InvalidEncoding)
            );
        }
    }

    #[test]
    fn ml65_round_trip_is_context_bound_and_tamper_evident() {
        let seed = [7_u8; 32];
        let sk = MlSigningKey::<MlDsa65>::from_seed(&seed.into());
        let message = b"phase-1 conformance";
        let signature = sk
            .expanded_key()
            .sign_deterministic(message, ML_DSA_65.context)
            .expect("frozen context is valid")
            .to_bytes();
        let pk = sk.verifying_key().encode();

        assert_eq!(verify(ML_DSA_65.id, &pk, message, &signature), Ok(()));
        assert_eq!(
            verify(ML_DSA_65.id, &pk, b"phase-1 tampered", &signature),
            Err(VerifyError::VerificationFailed)
        );
    }

    #[test]
    fn ml65_repeated_hint_encoding_is_rejected() {
        let seed = [9_u8; 32];
        let sk = MlSigningKey::<MlDsa65>::from_seed(&seed.into());
        let mut found = false;

        for counter in 0_u16..512 {
            let message = counter.to_be_bytes();
            let signature = sk
                .expanded_key()
                .sign_deterministic(&message, ML_DSA_65.context)
                .expect("frozen context is valid");
            let mut bytes = signature.to_bytes();
            let hint_start = ML_DSA_65.signature_len - (55 + 6);
            let counts = &bytes[ML_DSA_65.signature_len - 6..];
            let mut prior = 0_usize;
            let mut pair = None;
            for count in counts {
                let next = usize::from(*count);
                if next >= prior + 2 {
                    pair = Some(prior);
                    break;
                }
                prior = next;
            }
            if let Some(index) = pair {
                bytes[hint_start + index + 1] = bytes[hint_start + index];
                assert!(MlSignature::<MlDsa65>::decode(&bytes).is_none());
                found = true;
                break;
            }
        }

        assert!(
            found,
            "failed to construct the repeated-hint regression case"
        );
    }
}
