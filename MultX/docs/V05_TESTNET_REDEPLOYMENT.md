# MultX v0.5 paused testnet redeployment

This procedure prepares new Kamet/Makalu testnet contracts from the immutable
`multx-audit-candidate-v0.5.0-20260809`. It does not upgrade, overwrite, or
mislabel the historical deployments. MultX remains disabled on LITHO mainnet.

## Safety model

- The exact compiled `MultXBridge` runtime SHA-256 must match the published
  candidate evidence.
- The manifest requires seven unique public bridge-signer addresses and a
  5-of-7 threshold.
- Chain ID, Hardhat network, token code, and ERC-20 symbols are checked against
  the selected RPC before any transaction.
- Governance owner and pause guardian must be distinct approved addresses.
- Every supported token requires a positive, explicit base-unit fixed-window lock/release cap.
- Preflight is the default and signs nothing.
- Execution is rejected unless the current time is inside the manifest's exact
  approved UTC start/end window.
- Execution requires the exact manifest SHA-256 and approval record, plus an
  expected deployer whose private key is read from a protected local file.
- The new bridge is paused before tokens are enabled and remains paused after
  ownership transfer.
- A sanitized evidence record is written only after bytecode, roles, validator
  set, threshold, token support, caps, and paused state are verified.

## Prepare an approved manifest

Copy
`contracts/deployments/templates/v05-testnet-redeployment.example.json` outside
the public checkout or into the approved private operations repository. Add
only approved public addresses, public token routes/caps, and approval
references. Never add private keys, mnemonics, TLS private keys, or credentials.

The example contains LAX only to avoid assuming approval for other assets.
Add additional token entries only after their routes and caps are approved.

## Preflight

```bash
cd MultX/contracts
npm ci
npm run compile

MULTX_DEPLOYMENT_MANIFEST=/protected/approved-v05-testnet.json \
MULTX_NETWORK_KEY=kamet \
npx hardhat run scripts/deploy-v05-testnet.js --network litho_kamet
```

Repeat with `MULTX_NETWORK_KEY=makalu` and `--network litho_makalu` when both
networks are approved. Record the printed manifest SHA-256 for independent
review.

## Controlled execution

Execution is allowed only in the approved change window:

```bash
MULTX_DEPLOYMENT_MANIFEST=/protected/approved-v05-testnet.json \
MULTX_NETWORK_KEY=kamet \
MULTX_EXECUTE=true \
DEPLOYER_PRIVATE_KEY_FILE=/protected/deployer.key \
APPROVED_MANIFEST_SHA256=<independently-reviewed-sha256> \
APPROVED_CHANGE_RECORD=<exact-approval-record> \
MULTX_DEPLOYMENT_OUTPUT=/protected/kamet-v05-deployment.json \
npx hardhat run scripts/deploy-v05-testnet.js --network litho_kamet
```

On POSIX systems the key file must not be group/world accessible. Do not put
the key file or output directory in Git. Review and sanitize the generated
evidence before publishing a deployment manifest.

## Post-deployment gates

Do not unpause after deployment. First verify independent signer mTLS,
signature-domain separation, quorum, replay rejection, anti-equivocation
persistence, backup restoration, monitoring, rollback, and bounded-value
end-to-end tests. Production still requires the independent audit and written
activation approval.
