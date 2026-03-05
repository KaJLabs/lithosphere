import type { PageInfo } from '@/lib/types';

export default function Pagination({
  pageInfo,
  onPageChange,
}: {
  pageInfo: PageInfo;
  onPageChange: (offset: number) => void;
}) {
  const { total, limit, offset, hasMore } = pageInfo;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-[var(--color-text-muted)]">
        {total > 0
          ? `Showing ${offset + 1}-${Math.min(offset + limit, total)} of ${total.toLocaleString()}`
          : 'No results'}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]
            hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <span className="text-[var(--color-text-secondary)] px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={!hasMore}
          className="px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]
            hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
