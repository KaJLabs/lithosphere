# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Makalu Testnet (current) | Yes |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in the Lithosphere protocol, explorer, APIs, or any associated infrastructure, please report it responsibly.

### How to Report

- **Email**: security@litho.ai
- **Subject line**: `[SECURITY] <brief description>`
- **Include**: Steps to reproduce, affected components, potential impact, and any suggested fixes

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
2. **Assessment**: Our team will assess the severity and impact within 5 business days.
3. **Resolution**: We will work on a fix and coordinate disclosure with you.
4. **Credit**: With your permission, we will credit you in the security advisory.

### Scope

The following are in scope for responsible disclosure:

- Lithosphere node software (`lithod`)
- Explorer and block explorer APIs (`makalu.litho.ai`)
- Public RPC endpoints (`rpc.litho.ai`, `api.litho.ai`)
- Smart contract standards (LEP100)
- SDKs and developer tools

### Out of Scope

- Denial-of-service attacks against production infrastructure
- Social engineering of team members
- Third-party services not operated by Lithosphere

### Disclosure Policy

- Do not publicly disclose the vulnerability before we have had a chance to address it.
- Do not exploit the vulnerability beyond what is necessary to demonstrate it.
- Do not access or modify data belonging to other users.

## Security Audits

Lithosphere is actively pursuing third-party security audits. Completed audit reports will be published here with scope statements and remediation status as they become available.

## Offline Release-Signing Key

KaJ Labs authenticates designated offline audit and release artifacts with the
following organizational OpenPGP key. Verify this fingerprint through this
repository before trusting a detached signature received through another
channel:

```text
KaJ Labs Release Signing
Primary fingerprint: 073B 5DB3 50EF 4BEB D939 F243 1032 6AAA 1839 EAEB
Signing subkey:       7138 DEE3 D051 92AB 157C 7E8C 3B3A 6159 F3A5 EEDE
Primary-key expiry:   2027-09-01
```

An expiry extension or replacement key must be published here through a
reviewed repository change before it is used. A fingerprint identifies a key;
it does not by itself authorize an artifact or network activation.
