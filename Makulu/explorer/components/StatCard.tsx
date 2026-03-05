import { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-litho-400/10 text-litho-400 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            {label}
          </div>
          <div className="text-lg font-semibold truncate">{value}</div>
        </div>
      </div>
    </div>
  );
}
