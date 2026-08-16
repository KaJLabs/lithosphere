# MultX AWS Fargate signer architecture

Status: verification-only. This package must not be used to authorize bridge
transactions until the audit and activation gates are approved.

## Design

MultX uses seven ECS Fargate services and seven non-exportable AWS KMS
`ECC_SECG_P256K1` keys. Each service receives a distinct ECS task role whose
policy grants `kms:GetPublicKey`, `kms:DescribeKey`, and `kms:Sign` on exactly
one key. The configured threshold remains 5-of-7.

Native ECS task credentials replace IAM Roles Anywhere for these workloads.
No CA, client certificate, permanent AWS access key, plaintext validator key,
or signer bearer token is required.

The current container is intentionally transaction-free. It derives the KMS
public address, signs a fixed verification challenge, verifies address
recovery, exposes a loopback-only health endpoint, and then remains idle. It
fails startup unless `SIGNER_VERIFY_ONLY=true` and
`VALIDATOR_SIGNING_ENABLED=false`.

## Source and deployment

- Image: `MultX/api/Dockerfile.fargate-signer`
- Worker: `MultX/api/src/fargateSignerWorker.js`
- KMS adapter: `MultX/api/src/services/kmsSigner.js`
- Production provisioning, resource mappings, and verification evidence are
  maintained in the private `KaJLabs/Lithosphere-Production-Infra`
  repository.

Production deployment must use an immutable ECR digest and the approved AWS
account and region. Infrastructure changes require review and an approved
change window.

## Production activation boundary

The verification worker does not implement bridge transaction signing. Before
adding that capability, the reviewed design must provide independent lock
verification, durable anti-equivocation state, authenticated private API
connectivity, monitoring and rollback. The final implementation and contracts
must pass the independent security audit and fix review before MultX is
enabled.
