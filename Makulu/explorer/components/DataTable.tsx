import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No data available',
  rowKey,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (item: T) => string;
}) {
  if (loading) {
    return (
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card p-8 text-center text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={rowKey(item)}>
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
