import CopyButton from './CopyButton';

export default function HashDisplay({
  hash,
  truncateStart = 10,
  truncateEnd = 6,
  full = false,
}: {
  hash: string;
  truncateStart?: number;
  truncateEnd?: number;
  full?: boolean;
}) {
  if (!hash) return <span className="text-[var(--color-text-muted)]">-</span>;

  const displayed = full
    ? hash
    : hash.length <= truncateStart + truncateEnd + 3
      ? hash
      : `${hash.slice(0, truncateStart)}...${hash.slice(-truncateEnd)}`;

  return (
    <span className="inline-flex items-center font-mono text-sm">
      <span>{displayed}</span>
      <CopyButton text={hash} />
    </span>
  );
}
