import { DECIMALS } from './constants';

export function truncateHash(hash: string, start = 10, end = 6): string {
  if (!hash) return '';
  if (hash.length <= start + end + 3) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

export function truncateAddress(addr: string, start = 12, end = 6): string {
  return truncateHash(addr, start, end);
}

export function formatNumber(n: string | number | null | undefined): string {
  if (n == null) return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

export function formatLitho(amount: string | null | undefined): string {
  if (!amount) return '0 LITHO';
  const raw = BigInt(amount);
  const whole = raw / BigInt(10 ** DECIMALS);
  const frac = raw % BigInt(10 ** DECIMALS);
  const fracStr = frac.toString().padStart(DECIMALS, '0').slice(0, 4);
  const wholeFormatted = whole.toLocaleString('en-US');
  if (frac === BigInt(0)) return `${wholeFormatted} LITHO`;
  return `${wholeFormatted}.${fracStr} LITHO`;
}

export function formatGas(gas: string | null | undefined): string {
  if (!gas) return '-';
  return formatNumber(gas);
}

export function timeAgo(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export function isBech32Address(addr: string): boolean {
  return addr.startsWith('litho1');
}

export function isValidatorAddress(addr: string): boolean {
  return addr.startsWith('lithovaloper1');
}

export function formatBlockTime(seconds: number | null | undefined): string {
  if (seconds == null) return '-';
  return `${seconds.toFixed(2)}s`;
}

export function validatorStatusLabel(status: number): string {
  switch (status) {
    case 1: return 'Unbonded';
    case 2: return 'Unbonding';
    case 3: return 'Bonded';
    default: return 'Unknown';
  }
}

export function proposalStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'passed': return 'badge-success';
    case 'rejected': return 'badge-error';
    case 'voting_period': return 'badge-info';
    case 'deposit_period': return 'badge-warning';
    default: return 'badge-neutral';
  }
}
