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
    /// A consensus-facing wrapper received a value other than SigningRootV1.
    InvalidSigningRoot,
}

/// Verify an exact 64-byte SigningRootV1 value.
///
/// This remains isolated and non-consensus. Phase 2 integrations must use this
/// bounded entry point rather than passing arbitrary application messages to
/// [`verify`].
pub fn verify_signing_root(
    profile_id: u16,
    public_key: &[u8],
    signing_root: &[u8],
    signature: &[u8],
) -> Result<(), VerifyError> {
    if signing_root.len() != 64 {
        return Err(VerifyError::InvalidSigningRoot);
    }
    verify(profile_id, public_key, signing_root, signature)
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
    use ml_dsa::{ExpandedSigningKey, ExpandedSigningKeyBytes, SignatureEncoding};

    macro_rules! fixture {
        ($name:literal) => {
            include_bytes!(concat!("../fixtures/nist/", $name)).as_slice()
        };
    }

    #[test]
    fn frozen_profile_table_matches_r9() {
        assert_eq!(
            PROFILES,
            [
                Profile {
                    id: 0x0101,
                    name: "ML_DSA_65_FIPS204_2024_CORR20260731_V1",
                    context: b"LITHO-PQ-AUTH-V1",
                    public_key_len: 1952,
                    signature_len: 3309,
                },
                Profile {
                    id: 0x0102,
                    name: "ML_DSA_87_FIPS204_2024_CORR20260731_V1",
                    context: b"LITHO-PQ-AUTH-V1",
                    public_key_len: 2592,
                    signature_len: 4627,
                },
                Profile {
                    id: 0x0201,
                    name: "SLH_DSA_SHAKE_256S_FIPS205_2024_V1",
                    context: b"LITHO-PQ-RECOVERY-V1",
                    public_key_len: 64,
                    signature_len: 29_792,
                },
            ]
        );
    }

    #[test]
    fn declared_lengths_match_live_crate_encodings() {
        let ml65 = MlSigningKey::<MlDsa65>::from_seed(&[1_u8; 32].into());
        let ml65_sig = ml65
            .expanded_key()
            .sign_deterministic(b"length", ML_DSA_65.context)
            .expect("frozen context is valid")
            .to_bytes();
        assert_eq!(
            ml65.verifying_key().encode().len(),
            ML_DSA_65.public_key_len
        );
        assert_eq!(ml65_sig.len(), ML_DSA_65.signature_len);

        let ml87 = MlSigningKey::<MlDsa87>::from_seed(&[2_u8; 32].into());
        let ml87_sig = ml87
            .expanded_key()
            .sign_deterministic(b"length", ML_DSA_87.context)
            .expect("frozen context is valid")
            .to_bytes();
        assert_eq!(
            ml87.verifying_key().encode().len(),
            ML_DSA_87.public_key_len
        );
        assert_eq!(ml87_sig.len(), ML_DSA_87.signature_len);

        let slh =
            SlhSigningKey::<Shake256s>::slh_keygen_internal(&[3_u8; 32], &[4_u8; 32], &[5_u8; 32]);
        let slh_sig = slh
            .try_sign_with_context(b"length", SLH_DSA_SHAKE_256S.context, None)
            .expect("frozen context is valid")
            .to_bytes();
        let slh_pk = <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&slh)
            .to_bytes();
        assert_eq!(slh_pk.len(), SLH_DSA_SHAKE_256S.public_key_len);
        assert_eq!(slh_sig.len(), SLH_DSA_SHAKE_256S.signature_len);
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
            for public_key_len in [profile.public_key_len - 1, profile.public_key_len + 1] {
                assert_eq!(
                    verify(
                        profile.id,
                        &vec![0; public_key_len],
                        b"message",
                        &vec![0; profile.signature_len]
                    ),
                    Err(VerifyError::InvalidEncoding)
                );
            }
            for signature_len in [profile.signature_len - 1, profile.signature_len + 1] {
                assert_eq!(
                    verify(
                        profile.id,
                        &vec![0; profile.public_key_len],
                        b"message",
                        &vec![0; signature_len]
                    ),
                    Err(VerifyError::InvalidEncoding)
                );
            }
        }
    }

    #[test]
    fn signing_root_wrapper_requires_exactly_64_bytes() {
        assert_eq!(
            verify_signing_root(ML_DSA_65.id, &[], &[0_u8; 63], &[]),
            Err(VerifyError::InvalidSigningRoot)
        );
        assert_eq!(
            verify_signing_root(ML_DSA_65.id, &[], &[0_u8; 65], &[]),
            Err(VerifyError::InvalidSigningRoot)
        );
        assert_eq!(
            verify_signing_root(0xffff, &[], &[0_u8; 64], &[]),
            Err(VerifyError::UnsupportedProfile)
        );
    }

    #[test]
    fn nist_acvp_signature_generation_kats_pass() {
        let ml65_bytes: &ExpandedSigningKeyBytes<MlDsa65> = fixture!("ml65-siggen-tc31.sk.bin")
            .try_into()
            .expect("fixture has the frozen expanded-key length");
        #[allow(deprecated)]
        let ml65 = ExpandedSigningKey::<MlDsa65>::from_expanded(ml65_bytes);
        let ml65_signature = ml65
            .sign_deterministic(
                fixture!("ml65-siggen-tc31.message.bin"),
                fixture!("ml65-siggen-tc31.context.bin"),
            )
            .expect("NIST context is valid")
            .to_bytes();
        assert_eq!(
            ml65.verifying_key().encode().as_slice(),
            fixture!("ml65-siggen-tc31.pk.bin")
        );
        assert_eq!(
            ml65_signature.as_slice(),
            fixture!("ml65-siggen-tc31.signature.bin")
        );

        let ml87_bytes: &ExpandedSigningKeyBytes<MlDsa87> = fixture!("ml87-siggen-tc61.sk.bin")
            .try_into()
            .expect("fixture has the frozen expanded-key length");
        #[allow(deprecated)]
        let ml87 = ExpandedSigningKey::<MlDsa87>::from_expanded(ml87_bytes);
        let ml87_signature = ml87
            .sign_deterministic(
                fixture!("ml87-siggen-tc61.message.bin"),
                fixture!("ml87-siggen-tc61.context.bin"),
            )
            .expect("NIST context is valid")
            .to_bytes();
        assert_eq!(
            ml87.verifying_key().encode().as_slice(),
            fixture!("ml87-siggen-tc61.pk.bin")
        );
        assert_eq!(
            ml87_signature.as_slice(),
            fixture!("ml87-siggen-tc61.signature.bin")
        );

        let slh = SlhSigningKey::<Shake256s>::try_from(fixture!("slh256s-siggen-tc252.sk.bin"))
            .expect("fixture has a valid signing key");
        let slh_signature = slh
            .try_sign_with_context(
                fixture!("slh256s-siggen-tc252.message.bin"),
                fixture!("slh256s-siggen-tc252.context.bin"),
                None,
            )
            .expect("NIST context is valid")
            .to_bytes();
        let slh_pk = <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&slh)
            .to_bytes();
        assert_eq!(slh_pk.as_slice(), fixture!("slh256s-siggen-tc252.pk.bin"));
        assert_eq!(
            slh_signature.as_slice(),
            fixture!("slh256s-siggen-tc252.signature.bin")
        );
    }

    #[test]
    fn nist_acvp_signature_verification_kats_pass() {
        assert!(nist_verify_ml65("ml65-sigver-valid-tc33", true));
        assert!(nist_verify_ml65("ml65-sigver-invalid-tc31", false));
        assert!(nist_verify_ml87("ml87-sigver-valid-tc63", true));
        assert!(nist_verify_ml87("ml87-sigver-invalid-tc61", false));
        assert!(nist_verify_slh("slh256s-sigver-valid-tc399", true));
        assert!(nist_verify_slh("slh256s-sigver-invalid-tc393", false));
    }

    fn nist_verify_ml65(case: &str, expected: bool) -> bool {
        let (pk, message, context, signature) = nist_verification_case(case);
        let pk = pk.try_into().expect("fixture public key length");
        let signature = signature
            .try_into()
            .ok()
            .and_then(|encoded| MlSignature::<MlDsa65>::decode(&encoded));
        let actual = signature.is_some_and(|signature| {
            ml_dsa::VerifyingKey::<MlDsa65>::decode(&pk)
                .verify_with_context(message, context, &signature)
        });
        actual == expected
    }

    fn nist_verify_ml87(case: &str, expected: bool) -> bool {
        let (pk, message, context, signature) = nist_verification_case(case);
        let pk = pk.try_into().expect("fixture public key length");
        let signature = signature
            .try_into()
            .ok()
            .and_then(|encoded| MlSignature::<MlDsa87>::decode(&encoded));
        let actual = signature.is_some_and(|signature| {
            ml_dsa::VerifyingKey::<MlDsa87>::decode(&pk)
                .verify_with_context(message, context, &signature)
        });
        actual == expected
    }

    fn nist_verify_slh(case: &str, expected: bool) -> bool {
        let (pk, message, context, signature) = nist_verification_case(case);
        let actual = SlhVerifyingKey::<Shake256s>::try_from(pk)
            .ok()
            .zip(SlhSignature::<Shake256s>::try_from(signature).ok())
            .is_some_and(|(vk, signature)| {
                vk.try_verify_with_context(message, context, &signature)
                    .is_ok()
            });
        actual == expected
    }

    fn nist_verification_case(
        case: &str,
    ) -> (&'static [u8], &'static [u8], &'static [u8], &'static [u8]) {
        match case {
            "ml65-sigver-valid-tc33" => (
                fixture!("ml65-sigver-valid-tc33.pk.bin"),
                fixture!("ml65-sigver-valid-tc33.message.bin"),
                fixture!("ml65-sigver-valid-tc33.context.bin"),
                fixture!("ml65-sigver-valid-tc33.signature.bin"),
            ),
            "ml65-sigver-invalid-tc31" => (
                fixture!("ml65-sigver-invalid-tc31.pk.bin"),
                fixture!("ml65-sigver-invalid-tc31.message.bin"),
                fixture!("ml65-sigver-invalid-tc31.context.bin"),
                fixture!("ml65-sigver-invalid-tc31.signature.bin"),
            ),
            "ml87-sigver-valid-tc63" => (
                fixture!("ml87-sigver-valid-tc63.pk.bin"),
                fixture!("ml87-sigver-valid-tc63.message.bin"),
                fixture!("ml87-sigver-valid-tc63.context.bin"),
                fixture!("ml87-sigver-valid-tc63.signature.bin"),
            ),
            "ml87-sigver-invalid-tc61" => (
                fixture!("ml87-sigver-invalid-tc61.pk.bin"),
                fixture!("ml87-sigver-invalid-tc61.message.bin"),
                fixture!("ml87-sigver-invalid-tc61.context.bin"),
                fixture!("ml87-sigver-invalid-tc61.signature.bin"),
            ),
            "slh256s-sigver-valid-tc399" => (
                fixture!("slh256s-sigver-valid-tc399.pk.bin"),
                fixture!("slh256s-sigver-valid-tc399.message.bin"),
                fixture!("slh256s-sigver-valid-tc399.context.bin"),
                fixture!("slh256s-sigver-valid-tc399.signature.bin"),
            ),
            "slh256s-sigver-invalid-tc393" => (
                fixture!("slh256s-sigver-invalid-tc393.pk.bin"),
                fixture!("slh256s-sigver-invalid-tc393.message.bin"),
                fixture!("slh256s-sigver-invalid-tc393.context.bin"),
                fixture!("slh256s-sigver-invalid-tc393.signature.bin"),
            ),
            _ => panic!("unknown NIST fixture case"),
        }
    }

    #[test]
    fn frozen_context_and_tamper_negatives_cover_all_profiles() {
        exercise_ml65_negatives();
        exercise_ml87_negatives();
        exercise_slh_negatives();
    }

    fn exercise_ml65_negatives() {
        let sk = MlSigningKey::<MlDsa65>::from_seed(&[7_u8; 32].into());
        let other = MlSigningKey::<MlDsa65>::from_seed(&[8_u8; 32].into());
        let message = b"phase-1 conformance";
        let signature = sk
            .expanded_key()
            .sign_deterministic(message, ML_DSA_65.context)
            .unwrap()
            .to_bytes();
        let wrong_context = sk
            .expanded_key()
            .sign_deterministic(message, b"WRONG-CONTEXT")
            .unwrap()
            .to_bytes();
        exercise_public_negatives(
            ML_DSA_65,
            &sk.verifying_key().encode(),
            &other.verifying_key().encode(),
            message,
            &signature,
            &wrong_context,
        );
    }

    fn exercise_ml87_negatives() {
        let sk = MlSigningKey::<MlDsa87>::from_seed(&[17_u8; 32].into());
        let other = MlSigningKey::<MlDsa87>::from_seed(&[18_u8; 32].into());
        let message = b"phase-1 conformance";
        let signature = sk
            .expanded_key()
            .sign_deterministic(message, ML_DSA_87.context)
            .unwrap()
            .to_bytes();
        let wrong_context = sk
            .expanded_key()
            .sign_deterministic(message, b"WRONG-CONTEXT")
            .unwrap()
            .to_bytes();
        exercise_public_negatives(
            ML_DSA_87,
            &sk.verifying_key().encode(),
            &other.verifying_key().encode(),
            message,
            &signature,
            &wrong_context,
        );
    }

    fn exercise_slh_negatives() {
        let sk = SlhSigningKey::<Shake256s>::slh_keygen_internal(
            &[27_u8; 32],
            &[28_u8; 32],
            &[29_u8; 32],
        );
        let other = SlhSigningKey::<Shake256s>::slh_keygen_internal(
            &[37_u8; 32],
            &[38_u8; 32],
            &[39_u8; 32],
        );
        let message = b"phase-1 conformance";
        let signature = sk
            .try_sign_with_context(message, SLH_DSA_SHAKE_256S.context, None)
            .unwrap()
            .to_bytes();
        let wrong_context = sk
            .try_sign_with_context(message, b"WRONG-CONTEXT", None)
            .unwrap()
            .to_bytes();
        let pk =
            <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&sk).to_bytes();
        let other_pk =
            <SlhSigningKey<Shake256s> as AsRef<SlhVerifyingKey<Shake256s>>>::as_ref(&other)
                .to_bytes();
        exercise_public_negatives(
            SLH_DSA_SHAKE_256S,
            &pk,
            &other_pk,
            message,
            &signature,
            &wrong_context,
        );
    }

    fn exercise_public_negatives(
        profile: Profile,
        pk: &[u8],
        other_pk: &[u8],
        message: &[u8],
        signature: &[u8],
        wrong_context: &[u8],
    ) {
        assert_eq!(verify(profile.id, pk, message, signature), Ok(()));
        assert_eq!(
            verify(profile.id, pk, b"tampered message", signature),
            Err(VerifyError::VerificationFailed)
        );
        assert_eq!(
            verify(profile.id, other_pk, message, signature),
            Err(VerifyError::VerificationFailed)
        );
        assert_eq!(
            verify(profile.id, pk, message, wrong_context),
            Err(VerifyError::VerificationFailed)
        );
        let mut tampered = signature.to_vec();
        tampered[0] ^= 1;
        assert_ne!(verify(profile.id, pk, message, &tampered), Ok(()));
    }

    #[test]
    fn ml65_repeated_hint_encoding_is_rejected_through_public_verifier() {
        repeated_hint_is_rejected_ml65();
    }

    fn repeated_hint_is_rejected_ml65() {
        let sk = MlSigningKey::<MlDsa65>::from_seed(&[9_u8; 32].into());
        let pk = sk.verifying_key().encode();
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
                assert_eq!(
                    verify(ML_DSA_65.id, &pk, &message, &bytes),
                    Err(VerifyError::InvalidEncoding)
                );
                found = true;
                break;
            }
        }

        assert!(
            found,
            "failed to construct the repeated-hint regression case"
        );
    }

    #[test]
    fn ml87_repeated_hint_encoding_is_rejected_through_public_verifier() {
        let sk = MlSigningKey::<MlDsa87>::from_seed(&[19_u8; 32].into());
        let pk = sk.verifying_key().encode();
        let mut found = false;

        for counter in 0_u16..512 {
            let message = counter.to_be_bytes();
            let signature = sk
                .expanded_key()
                .sign_deterministic(&message, ML_DSA_87.context)
                .unwrap();
            let mut bytes = signature.to_bytes();
            let hint_start = ML_DSA_87.signature_len - (75 + 8);
            let counts = &bytes[ML_DSA_87.signature_len - 8..];
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
                assert_eq!(
                    verify(ML_DSA_87.id, &pk, &message, &bytes),
                    Err(VerifyError::InvalidEncoding)
                );
                found = true;
                break;
            }
        }
        assert!(
            found,
            "failed to construct the ML-DSA-87 repeated-hint case"
        );
    }
}
