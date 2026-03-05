import { timeAgo } from '@/lib/format';

export default function TimeAgo({ timestamp }: { timestamp: string | null }) {
  if (!timestamp) return <span className="text-[var(--color-text-muted)]">-</span>;
  return (
    <span className="text-[var(--color-text-secondary)] text-sm" title={new Date(timestamp).toLocaleString()}>
      {timeAgo(timestamp)}
    </span>
  );
}
