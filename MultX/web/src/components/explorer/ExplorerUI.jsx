import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import {
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  shortenMiddle
} from '../../helpers/explorer';

export const PageHero = ({ eyebrow, title, description, actions, meta }) => (
  <div className="explorerHero">
    <div className="explorerHero-copy">
      {eyebrow ? <div className="explorerEyebrow">{eyebrow}</div> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {meta ? <div className="heroMeta">{meta}</div> : null}
    </div>
    {actions ? <div className="explorerActions">{actions}</div> : null}
  </div>
);

export const MetricCard = ({ label, value, subtext, onClick, tone = 'default', loading = false }) => {
  const content = (
    <div className={`statCard ${onClick ? 'clickable' : ''} ${tone !== 'default' ? `tone-${tone}` : ''}`}>
      <span className="statLabel">{label}</span>
      <strong>{loading ? <span className="skeleton skeleton-text short" /> : value}</strong>
      {subtext ? <div className="statSubtext">{subtext}</div> : null}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" className="unstyledButton" onClick={onClick}>
        {content}
      </button>
    );
  }

  return content;
};

export const Panel = ({ title, description, actions, children }) => (
  <div className="explorerPanel">
    {(title || description || actions) && (
      <div className="panelHeader">
        <div>
          {title ? <div className="explorerSectionTitle">{title}</div> : null}
          {description ? <p className="panelDescription">{description}</p> : null}
        </div>
        {actions ? <div className="panelActions">{actions}</div> : null}
      </div>
    )}
    {children}
  </div>
);

export const SectionMessage = ({ tone = 'info', children, action }) => (
  <div className={`explorerMessage ${tone}`}>
    <div>{children}</div>
    {action || null}
  </div>
);

export const EmptyState = ({ title, description, action }) => (
  <div className="emptyStateCard">
    <strong>{title}</strong>
    {description ? <p>{description}</p> : null}
    {action || null}
  </div>
);

export const ExplorerErrorState = ({
  error,
  onRetry,
  retryLabel = 'Retry',
  emptyAction = null
}) => {
  if (!error) {
    return null;
  }

  if (error.retryable) {
    return (
      <SectionMessage
        tone="error"
        action={
          onRetry ? (
            <button type="button" className="secondary-btn" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null
        }
      >
        {error.message}
      </SectionMessage>
    );
  }

  return (
    <EmptyState title={error.title} description={error.message} action={emptyAction} />
  );
};

export const LoadingSkeleton = ({ rows = 4 }) => (
  <div className="loadingList" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={`skeleton-${index}`} className="skeletonRow">
        <span className="skeleton skeleton-text short" />
        <span className="skeleton skeleton-text medium" />
        <span className="skeleton skeleton-text short" />
      </div>
    ))}
  </div>
);

export const VirtualizedTable = ({
  columns,
  colWidths,
  items,
  renderRow,
  ariaLabel,
  tableClassName = '',
  wrapperClassName = '',
  rowHeight = 80,
  maxHeight = 560,
  overscan = 4
}) => {
  const wrapperRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = typeof maxHeight === 'number' ? maxHeight : 560;
  const visibleRowCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const isVirtualized = items.length > visibleRowCount;
  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0;
  const endIndex = isVirtualized
    ? Math.min(items.length, startIndex + visibleRowCount + overscan * 2)
    : items.length;
  const topSpacerHeight = isVirtualized ? startIndex * rowHeight : 0;
  const bottomSpacerHeight = isVirtualized ? Math.max(0, (items.length - endIndex) * rowHeight) : 0;
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [endIndex, items, startIndex]);

  useEffect(() => {
    setScrollTop(0);
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = 0;
    }
  }, [items]);

  return (
    <div
      ref={wrapperRef}
      className={`tableWrap ${isVirtualized ? 'tableWrap-virtualized' : ''} ${wrapperClassName}`.trim()}
      data-virtualized={isVirtualized ? 'true' : 'false'}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{ maxHeight }}
    >
      <table
        className={`dataTable ${tableClassName}`.trim()}
        aria-label={ariaLabel}
        aria-rowcount={items.length + 1}
      >
        {colWidths?.length ? (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={typeof column === 'string' ? column : `column-${index}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topSpacerHeight ? (
            <tr className="virtualSpacerRow" aria-hidden="true">
              <td colSpan={columns.length} style={{ height: `${topSpacerHeight}px` }} />
            </tr>
          ) : null}
          {visibleItems.map((item, index) => {
            const absoluteIndex = startIndex + index;
            const row = renderRow(item, absoluteIndex);

            if (!isValidElement(row)) {
              return row;
            }

            return cloneElement(row, {
              'aria-rowindex': absoluteIndex + 2
            });
          })}
          {bottomSpacerHeight ? (
            <tr className="virtualSpacerRow" aria-hidden="true">
              <td colSpan={columns.length} style={{ height: `${bottomSpacerHeight}px` }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

export const CopyButton = ({ value, label = 'Copy' }) => {
  const { copiedValue, copy } = useCopyToClipboard();
  const copied = copiedValue === value;

  return (
    <button
      type="button"
      className={`copyButton ${copied ? 'copied' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        copy(value);
      }}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

export const CopyableValue = ({ value, shortStart = 12, shortEnd = 8, preserve = false, href }) => {
  if (!value || value === '--') {
    return <span>--</span>;
  }

  const displayValue = preserve ? value : shortenMiddle(value, shortStart, shortEnd);
  const valueNode = href ? (
    <Link
      to={href}
      className="copyableValue-link"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <code>{displayValue}</code>
    </Link>
  ) : (
    <code>{displayValue}</code>
  );

  return (
    <span className="copyableValue" title={value}>
      {valueNode}
      <CopyButton value={value} label={`Copy ${value}`} />
    </span>
  );
};

export const StatusBadge = ({ children, tone = 'neutral' }) => (
  <span className={`statusBadge ${tone}`}>{children}</span>
);

export const TimestampValue = ({ value, compact = false }) => {
  if (!value) {
    return <span>--</span>;
  }

  return (
    <span className="timestampValue" title={formatDateTime(value)}>
      <strong>{formatRelativeTime(value)}</strong>
      {!compact && <span>{formatDateTime(value)}</span>}
    </span>
  );
};

export const PaginationControls = ({ page, totalPages, onPageChange }) => (
  <div className="paginationControls">
    <button type="button" className="secondary-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
      Previous
    </button>
    <span>
      Page {formatNumber(page)} of {formatNumber(totalPages)}
    </span>
    <button
      type="button"
      className="secondary-btn"
      onClick={() => onPageChange(page + 1)}
      disabled={page >= totalPages}
    >
      Next
    </button>
  </div>
);

export const SortButton = ({ label, active, direction, onToggle }) => (
  <button type="button" className={`sortButton ${active ? 'active' : ''}`} onClick={onToggle}>
    {label}
    <span aria-hidden="true">{active && direction === 'asc' ? '^' : 'v'}</span>
  </button>
);

export const DataTabs = ({ tabs, activeTab, onChange, idBase, label = 'Explorer tabs' }) => {
  const generatedId = useId().replace(/:/g, '');
  const resolvedIdBase = idBase || `explorer-tabs-${generatedId}`;

  return (
    <div className="tabStrip" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        const tabId = `${resolvedIdBase}-tab-${tab.id}`;
        const panelId = `${resolvedIdBase}-panel-${tab.id}`;

        return (
          <button
            key={tab.id}
            id={tabId}
            type="button"
            className={`tabButton ${selected ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            disabled={tab.disabled}
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls={panelId}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const FreshnessPill = ({ indexedThroughBlock, lastUpdated, transport = 'polling', staleData = false }) => (
  <div className={`freshnessPill ${staleData ? 'delayed' : ''}`}>
    <span>Indexed through block {formatNumber(indexedThroughBlock)}</span>
    <span>Updated {lastUpdated ? formatRelativeTime(lastUpdated) : '--'}</span>
    <span>{transport === 'websocket' ? 'Live via WebSocket' : 'Polling fallback'}</span>
  </div>
);
