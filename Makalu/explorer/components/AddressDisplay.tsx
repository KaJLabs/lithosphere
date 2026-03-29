import Link from 'next/link';
import { truncateAddress } from '@/lib/format';
import CopyButton from './CopyButton';

export default function AddressDisplay({
  address,
  truncate = true,
}: {
  address: string | null;
  truncate?: boolean;
}) {
  if (!address) return <span className="text-[var(--color-text-muted)]">-</span>;

  return (
    <span className="inline-flex items-center font-mono text-sm">
      <Link href={`/address/${address}`} className="hover:underline">
        {truncate ? truncateAddress(address) : address}
      </Link>
      <CopyButton text={address} />
    </span>
  );
}
