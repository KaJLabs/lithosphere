/**
 * Check faucet wallet LEP100 token balances on Kamet (900523).
 * Usage: npx hardhat run scripts/check-faucet-balances.js --network litho_kamet
 */
const hre = require("hardhat");

const FAUCET_WALLET = "0x43593dC799d432CB6382ae20186Ba5356AC7D271";

const TOKENS = [
  { symbol: "wLITHO", address: "0xC0FC628e3aB128fe387e7ed5e729bD809C017888" },
  { symbol: "LitBTC", address: "0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016" },
  { symbol: "LAX",    address: "0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb" },
  { symbol: "JOT",    address: "0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9" },
  { symbol: "COLLE",  address: "0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA" },
  { symbol: "IMAGE",  address: "0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0" },
  { symbol: "AGII",   address: "0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7" },
  { symbol: "BLDR",   address: "0xF05f1F79273874E554F02ce06585E16132a3B62B" },
  { symbol: "FGPT",   address: "0x2F366c6350A6b211f6D6F847c3D56738C2E847ca" },
  { symbol: "MUSA",   address: "0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42" },
  { symbol: "QTT",    address: "0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe" },
];

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

async function main() {
  const provider = hre.ethers.provider;
  console.log(`Faucet wallet: ${FAUCET_WALLET}\n`);
  console.log("Symbol   Balance (whole tokens)");
  console.log("------   --------------------");
  for (const t of TOKENS) {
    const contract = new hre.ethers.Contract(t.address, ERC20_ABI, provider);
    const raw = await contract.balanceOf(FAUCET_WALLET);
    const whole = hre.ethers.utils.formatUnits(raw, 18);
    console.log(`${t.symbol.padEnd(8)} ${whole}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
