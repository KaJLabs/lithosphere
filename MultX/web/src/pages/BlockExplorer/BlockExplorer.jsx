import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { fetchBlocksPage } from '../../services/explorerDataService';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  PaginationControls,
  PageHero,
  Panel,
  SortButton,
  StatusBadge,
  TimestampValue,
  VirtualizedTable
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatBytes, formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const sortOptions = [
  { id: 'height', label: 'Height' },
  { id: 'timestamp', label: 'Time' },
  { id: 'txCount', label: 'Tx Count' },
  { id: 'gasUsed', label: 'Gas Used' }
];

export const BlockExplorer = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('height');
  const [sortDirection, setSortDirection] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Blocks', defaultExplorerDescription);

  const loadBlocks = useCallback(async () => {
    try {
      const data = await fetchBlocksPage({
        page,
        pageSize: 15,
        sortBy,
        sortDirection
      });
      setPayload(data);
      setError(null);
    } catch {
      try {
        const retryData = await fetchBlocksPage({
          page,
          pageSize: 15,
          sortBy,
          sortDirection
        });
        setPayload(retryData);
        setError(null);
      } catch (retryError) {
        setError(classifyExplorerError(retryError, { resourceLabel: 'block feed' }));
      }
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDirection]);

  useEffect(() => {
    setLoading(true);
    loadBlocks();
  }, [loadBlocks]);

  useRealtimeRefresh(
    async () => {
      await loadBlocks();
    },
    { enabled: page === 1, pollInterval: 4_000 }
  );

  const toggleSort = (nextSortBy) => {
    if (nextSortBy === sortBy) {
      setSortDirection((currentDirection) => (currentDirection === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(nextSortBy === 'height' ? 'desc' : 'asc');
  };

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Blocks"
        description="Browse Kamet blocks with direct deep links, proposer routing, gas usage, and exact plus relative timestamps."
        actions={
          <>
            {sortOptions.map((option) => (
              <SortButton
                key={option.id}
                label={option.label}
                active={sortBy === option.id}
                direction={sortDirection}
                onToggle={() => toggleSort(option.id)}
              />
            ))}
            <button type="button" className="primary-btn" onClick={() => loadBlocks()}>
              Refresh
            </button>
          </>
        }
      />

      {error ? <ExplorerErrorState error={error} onRetry={loadBlocks} /> : null}

      <Panel
        title="Block Feed"
        description="Committed blocks with proposer, gas usage, and finality status."
        actions={
          payload ? (
            <PaginationControls page={payload.page} totalPages={payload.totalPages} onPageChange={setPage} />
          ) : null
        }
      >
        {loading && !payload ? (
          <LoadingSkeleton rows={8} />
        ) : !payload?.items?.length ? (
          <EmptyState title="No blocks found" description="Block data will appear here once the public endpoints respond." />
        ) : (
          <VirtualizedTable
            ariaLabel="Block feed"
            columns={[
              'Block Height',
              'Timestamp',
              'Tx Count',
              'Validator / Proposer',
              'Gas Used',
              'Finality',
              'Size'
            ]}
            items={payload.items}
            tableClassName="blocksTable"
            rowHeight={88}
            maxHeight={620}
            renderRow={(block) => (
              <tr
                key={block.hash || block.height}
                {...getInteractiveRowProps({
                  onActivate: () => navigate(`/block/${block.height}`),
                  label: `Open block ${block.height}`
                })}
              >
                <td data-label="Block">{formatNumber(block.height)}</td>
                <td data-label="Time">
                  <TimestampValue value={block.timestamp} />
                </td>
                <td data-label="Txns">{formatNumber(block.txCount)}</td>
                <td data-label="Proposer">
                  {block.proposerAddress ? (
                    <CopyableValue value={block.proposerAddress} href={`/validator/${block.proposerAddress}`} />
                  ) : (
                    <span>{block.proposerMoniker || '--'}</span>
                  )}
                </td>
                <td data-label="Gas">{formatNumber(block.gasUsed)}</td>
                <td data-label="Finality">
                  <StatusBadge tone="success">{block.status}</StatusBadge>
                </td>
                <td data-label="Size">{formatBytes(block.size)}</td>
              </tr>
            )}
          />
        )}
      </Panel>
    </div>
  );
};

export default BlockExplorer;
