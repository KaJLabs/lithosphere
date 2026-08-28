# Frozen NIST Evidence Snapshot

**Retrieved:** 2026-08-25 from official NIST hosts

| SHA-256 | File | Official source |
|---|---|---|
| `1592607831ff0908cc590632ce371c6c95e94025bb1a0c8ae90a4d0ec1ed025e` | `NIST.FIPS.202.pdf` | `https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf` |
| `fe1f12f32a7e44ec9fdebbf400cda843a40b506dee676725234dc6f7923b6cac` | `NIST.FIPS.203.pdf` | `https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf` |
| `57239b9f84c03227eda3ca0991204dc7764c79af9ce2e6824eda774918d46b6b` | `NIST.FIPS.204.pdf` | `https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf` |
| `8ef34228276f3386d23cb0da8c14592b8cfb0db3358016bba64df7a004f8d13d` | `NIST.FIPS.205.pdf` | `https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf` |
| `edf899c89762449f43d7713883caeefc2e4ae9ae98d5a76b339547db22cb3ac7` | `fips-203-potential-updates.xlsx` | `https://csrc.nist.gov/files/pubs/fips/203/final/docs/fips-203-potential-updates.xlsx` |
| `5bc93ce63bc647e6d1d456cb2d3a171426c15aca4a7a0e0edd40d08b7a34c793` | `fips-204-potential-updates.xlsx` | `https://csrc.nist.gov/files/pubs/fips/204/final/docs/fips-204-potential-updates.xlsx` |

The spreadsheets state that potential corrections are not yet official changes and do not introduce new technical requirements. Lithosphere profile identifiers therefore name the selected frozen correction snapshot explicitly. A later NIST publication is not incorporated automatically.

## Normative row disposition

`ML_KEM_768_FIPS203_2024_V1` follows the published FIPS 203 PDF exactly and
does **not** apply either potential-update row (2025-03-31 Appendix A or
2025-10-17 Section 5.3). Those rows remain evidence only. This is intentional
and explains why the profile name has no correction-snapshot suffix.

`ML_DSA_65_FIPS204_2024_CORR20260731_V1` and
`ML_DSA_87_FIPS204_2024_CORR20260731_V1` apply every row present in the frozen
2026-07-31 spreadsheet exactly as written:

- 2024-09-20 Sections 2.5/7.5 NTT evaluation correction;
- 2024-10-17 Sections 6.2/6.3 `M` to `M'` correction;
- 2025-12-02 broken-link corrections (no encoding effect);
- 2025-12-02 Section 2 editorial/vector corrections (no encoding effect);
- 2025-12-02 Section 3 `mu || w1` correction;
- 2025-12-02 Section 5 `NULL` to failure-symbol correction;
- 2025-12-02 Section 6 terminology and `Power2Round` correction;
- 2025-12-02 Section 7 internal-algorithm references;
- 2025-12-02 Appendix A Montgomery-reduction corrections;
- 2026-02-23 Algorithm 3 returns false;
- 2026-02-27 Algorithm 40 upper-bound correction; and
- 2026-07-31 repetition values and minimum loop limit 821.

No future spreadsheet/PDF change is inherited. Changing any disposition
requires a new profile ID and new official vectors.
