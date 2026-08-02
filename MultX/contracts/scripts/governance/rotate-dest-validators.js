// Rotate a MultXBridgeDest validator set to the production KMS 5-of-7.
//
// The Sepolia / Base Sepolia dest bridges (0xfdA3b83F…) were deployed with an
// old 2-of-3 dev validator set, while the bridge-api relayer signs with the
// KMS 5-of-7 (kamet-validators-kms-2026-05-19.json). That mismatch makes every
// Kamet→dest releaseTokens revert "Invalid signer". This aligns the dest set to
// the KMS validators so cross-chain releases complete.
//
// Usage:
//   OWNER_PRIVATE_KEY=0x... node scripts/governance/rotate-dest-validators.js <sepolia|base>
//   (add DRY_RUN=1 to only read + print the intended change)
//
// The owner key is the DNNS deployer (0x6731…713C) — pull it from Secrets
// Manager (litho/dnns/deployer-key) into OWNER_PRIVATE_KEY; never hardcode it.

const { ethers } = require('ethers');

const DEST = '0xfdA3b83FE8438123eAF5153945A46F8fcF6175f4';
const THRESHOLD = 5;

// KMS 5-of-7 validator addresses — contracts/deployments/kamet-validators-kms-2026-05-19.json
const KMS_VALIDATORS = [
  '0xD9B30A7f4d58f1b98AaA69B82F0c8bF0816638FB',
  '0xEefB2E0c91Bc57975D117BADA6c70f3Cd6C4bC91',
  '0x4dFEd8e8359EaA711CdFFFcb5d994a66e46185Ac',
  '0x27026F8C232d723100700186c10B2aEbd82ea60C',
  '0xc8C5c89ddb70CAEC942f2C5A77F4F4001ef3B415',
  '0x4CDd6D160Bd79fe7d4Bab06a9E0607870e8108D9',
  '0xB161611185Ce2c95849134188AC9F5DbC26bfD2D',
];

const CHAINS = {
  sepolia: { name: 'Ethereum Sepolia', chainId: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com' },
  base:    { name: 'Base Sepolia',     chainId: 84532,    rpc: 'https://sepolia.base.org' },
};

const ABI = [
  'function owner() view returns (address)',
  'function getValidators() view returns (address[])',
  'function signaturesRequired() view returns (uint256)',
  'function setValidatorSet(address[] _validators, uint256 _signaturesRequired)',
];

const sameSet = (a, b) => {
  const la = a.map((x) => x.toLowerCase()).sort();
  const lb = b.map((x) => x.toLowerCase()).sort();
  return la.length === lb.length && la.every((x, i) => x === lb[i]);
};

(async () => {
  const which = (process.argv[2] || '').toLowerCase();
  const chain = CHAINS[which];
  if (!chain) { console.error('Usage: node rotate-dest-validators.js <sepolia|base>'); process.exit(1); }

  const pk = process.env.OWNER_PRIVATE_KEY;
  if (!pk) { console.error('Set OWNER_PRIVATE_KEY (DNNS deployer 0x6731…).'); process.exit(1); }

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc, chain.chainId);
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider);
  const bridge = new ethers.Contract(DEST, ABI, wallet);

  console.log(`\n== ${chain.name} (${chain.chainId}) — dest bridge ${DEST} ==`);
  const [owner, curVals, curSig, bal] = await Promise.all([
    bridge.owner(), bridge.getValidators(), bridge.signaturesRequired(), provider.getBalance(wallet.address),
  ]);
  console.log('  signer:', wallet.address, `(${ethers.utils.formatEther(bal)} ETH)`);
  console.log('  owner :', owner);
  console.log('  current set:', curSig.toString(), 'of', curVals.length, curVals);

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error('  ✗ signer is not the owner — cannot rotate.'); process.exit(1);
  }
  if (sameSet(curVals, KMS_VALIDATORS) && curSig.toNumber() === THRESHOLD) {
    console.log('  ✓ already KMS 5-of-7 — nothing to do.'); return;
  }

  console.log('  → target:', THRESHOLD, 'of', KMS_VALIDATORS.length, KMS_VALIDATORS);
  if (process.env.DRY_RUN) { console.log('  DRY_RUN — not sending.'); return; }

  const tx = await bridge.setValidatorSet(KMS_VALIDATORS, THRESHOLD);
  console.log('  tx:', tx.hash, '— waiting…');
  const rc = await tx.wait();
  console.log('  ✓ mined in block', rc.blockNumber, 'gas', rc.gasUsed.toString());

  const [newVals, newSig] = await Promise.all([bridge.getValidators(), bridge.signaturesRequired()]);
  console.log('  new set:', newSig.toString(), 'of', newVals.length);
  console.log('  ✓ aligned:', sameSet(newVals, KMS_VALIDATORS) && newSig.toNumber() === THRESHOLD);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
