# Lithosphere DNNS — ENS-fork Naming Service

ENS-style decentralized naming service deployed on Lithosphere Kamet (chainId 900523). v0 is **Kamet-only**, **`.litho` TLD**, **2LD only**, **free registration on testnet**.

Multi-chain expansion (ETH / BNB / Base via CCIP-Read) is deferred to v1+.

---

## Live Deployment (Kamet, chainId 900523)

Source of truth: [`deployments/kamet-latest.json`](deployments/kamet-latest.json)

| Contract                      | Address                                      |
| ----------------------------- | -------------------------------------------- |
| `ENSRegistry`                 | `0x316dc15bF377F7187e5BE38BA19e673Ca823d1ab` |
| `BaseRegistrarImplementation` | `0xB3D1a8e92FFAD73Ab8a07BF37A8E1374df8B3722` |
| `LithoRegistrarController`    | `0xb042145B0Fd44b53691b59E98bE8F9F9EB0365c5` |
| `PublicResolver`              | `0xc0F0849e09Df12E54fe4345ab4535B1F521f2190` |
| `ReverseRegistrar`            | `0xDeFae50866342C8f72bd03292FFeAeb53eC781C2` |
| `ZeroPriceOracle`             | `0xD3E0f31AB733C845ED9E4121d547Ca05E99384EB` |

**TLD node** (`namehash("litho")`): `0xe909d46f2bc25cccb05f02e1175c2d84a82f40f6cf869ba2a02e70459c252ac9`

### Reserved names (registered to deployer at deploy time)

`litho.litho`, `kamet.litho`, `makalu.litho`, `dex.litho`, `treasury.litho`, `team.litho`, `faucet.litho`, `quantts.litho`, `bridge.litho`

---

## Why a custom controller?

The off-the-shelf `ETHRegistrarController` from `@ensdomains/ens-contracts@1.4.0` requires `NameWrapper`, which **hardcodes the `.eth` namehash** in `_wrapETH2LD`. We can't reuse it for `.litho` without forking NameWrapper.sol.

`LithoRegistrarController.sol` (in `contracts/`) is a ~100-line minimal commit-reveal controller that calls `BaseRegistrar.register` directly, no NameWrapper. Same UX (commit → wait `minCommitmentAge` → register). Resolver records are set by the new owner in a separate tx.

---

## Scripts

The scripts that deploy or update contracts are disabled unless
`DNNS_DEPLOYMENT_APPROVED=true` and a dedicated deployer key is injected into
`DNNS_DEPLOYER_PRIVATE_KEY` by the approved secret manager. Never paste a key
into a command, repository file, workflow input, or chat message. Public
source availability is not deployment approval.

```bash
cd DNNS
npm ci

# 1. Deploy core (Registry, BaseRegistrar, Controller, PublicResolver, ReverseRegistrar, PriceOracle)
DNNS_DEPLOYMENT_APPROVED=true npm run deploy:core

# 2. Reserve brand names to deployer (commit, wait 65s, register, set addr records)
DNNS_DEPLOYMENT_APPROVED=true npm run reserve:names

# 3. Sanity-check resolution + availability
DNNS_DEPLOYMENT_APPROVED=true npm run resolve:test
```

There is no validator-key or generic-deployer-key fallback. CCIP deployment
accepts only the public `GATEWAY_SIGNER_ADDRESS`; it never derives that address
from a gateway private key.

---

## v0 Limitations

Documented intentional gaps:

- **Kamet only.** No multi-chain. v1 adds ETH/BNB/Base via CCIP-Read.
- **2LD only.** No subdomains. NameWrapper is intentionally absent (it hardcodes `.eth`).
- **Free pricing.** `ZeroPriceOracle` returns 0 base + 0 premium. v1 swaps in a USD-pegged oracle.
- **No reverse-resolution UX outside `/names`.** Address pages don't auto-show `<name>.litho`. Add to v1.
- **Resolver records are a separate transaction.** After registration, the new owner sends `registry.setResolver(...)` + `resolver.setAddr(...)` from the explorer's `/names/:name` UI.

---

## Frontend

The Names UI lives in `kamet-explorer/src/pages/Names/`. Configuration (deployed addresses, ABIs, `namehash`/`labelhash` helpers) is in `kamet-explorer/src/data/dnnsConfig.js`. Service functions are in `kamet-explorer/src/services/namesService.js`.

Routes:

- `/names` → search + register
- `/names/:name` → manage records + transfer

For the explorer integration and current acceptance evidence, see
[`docs/dnns-acceptance.md`](../docs/dnns-acceptance.md).

## Provenance and operational boundary

See [`PROVENANCE.md`](PROVENANCE.md) for the source history and public-release
boundary. Restricted administrative maintenance procedures, infrastructure
addresses, secret identifiers, and credential-retrieval commands are not part
of this public tree.
