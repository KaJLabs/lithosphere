import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Address,
  defineChain,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { config } from '../config.js';

const chain = defineChain({
  id: config.chainId,
  name: 'Lithosphere',
  nativeCurrency: { name: 'LITHO', symbol: 'LITHO', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

const transport = http(config.rpcUrl);

const publicClient = createPublicClient({ chain, transport });

let account: PrivateKeyAccount | null = null;

function getAccount(): PrivateKeyAccount {
  if (account) return account;
  if (!config.privateKey) {
    throw new Error('FAUCET_PRIVATE_KEY not set');
  }
  account = privateKeyToAccount(config.privateKey);
  return account;
}

export async function drip(recipient: Address, dripAmount?: string): Promise<{ txHash: string; amount: string }> {
  const acc = getAccount();
  const client = createWalletClient({ account: acc, chain, transport });
  const amountStr = dripAmount ?? config.dripAmount;
  const amount = parseEther(amountStr);

  const txHash = await client.sendTransaction({
    account: acc,
    to: recipient,
    value: amount,
    chain,
  });

  return { txHash, amount: amountStr };
}

export async function getFaucetBalance(): Promise<string> {
  if (!config.privateKey) return '0';
  const acc = getAccount();
  const balance = await publicClient.getBalance({ address: acc.address });
  return formatEther(balance);
}

export function getFaucetAddress(): string {
  if (!config.privateKey) return '0x0';
  return getAccount().address;
}
