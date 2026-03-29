export default function Loading({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-1/3" />
      <div className="h-5 bg-[var(--color-bg-tertiary)] rounded w-2/3" />
    </div>
  );
}
