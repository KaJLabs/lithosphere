import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';

const chain = {
  id: config.chainId,
  name: 'Lithosphere',
  nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

const transport = http(config.rpcUrl);

const publicClient = createPublicClient({ chain, transport });

let walletClient: ReturnType<typeof createWalletClient> | null = null;

function getWalletClient() {
  if (walletClient) return walletClient;

  if (!config.privateKey) {
    throw new Error('FAUCET_PRIVATE_KEY not set');
  }

  const account = privateKeyToAccount(config.privateKey);
  walletClient = createWalletClient({ account, chain, transport });
  return walletClient;
}

export async function drip(recipient: Address): Promise<{ txHash: string; amount: string }> {
  const client = getWalletClient();
  const amount = parseEther(config.dripAmount);

  const txHash = await client.sendTransaction({
    to: recipient,
    value: amount,
  });

  return { txHash, amount: config.dripAmount };
}

export async function getFaucetBalance(): Promise<string> {
  if (!config.privateKey) return '0';
  const account = privateKeyToAccount(config.privateKey);
  const balance = await publicClient.getBalance({ address: account.address });
  return formatEther(balance);
}

export function getFaucetAddress(): string {
  if (!config.privateKey) return '0x0';
  const account = privateKeyToAccount(config.privateKey);
  return account.address;
}
