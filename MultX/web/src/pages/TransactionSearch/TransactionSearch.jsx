import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { fetchTransactionsPage } from '../../services/explorerDataService';
import GlobalSearchForm from '../../components/explorer/GlobalSearchForm';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  PaginationControls,
  PageHero,
  Panel,
  StatusBadge,
  TimestampValue,
  VirtualizedTable
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

export const TransactionSearch = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Transactions', defaultExplorerDescription);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await fetchTransactionsPage({
        page,
        pageSize: 15,
        sortBy: 'blockHeight',
        sortDirection: 'desc'
      });
      setPayload(data);
      setError(null);
    } catch (loadError) {
      setError(classifyExplorerError(loadError, { resourceLabel: 'transaction feed' }));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    loadTransactions();
  }, [loadTransactions]);

  useRealtimeRefresh(
    async () => {
      await loadTransactions();
    },
    { enabled: page === 1, pollInterval: 12_000 }
  );

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Transactions"
        description="Search or browse recent Kamet transactions with sender, recipient, amount, fee, status, and direct detail links."
        actions={
          <button type="button" className="primary-btn refreshBtn" onClick={() => loadTransactions()}>
            <span className="refreshIcon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </span>
            Refresh
          </button>
        }
      />

      <Panel title="Search" description="Numeric input routes to blocks, full hashes to transactions, and addresses to wallets or contracts.">
        <GlobalSearchForm placeholder="Enter tx hash, block, wallet, validator, token symbol, or contract" />
      </Panel>

      {error ? <ExplorerErrorState error={error} onRetry={loadTransactions} /> : null}

      <Panel
        title="Transaction Feed"
        description="Kamet transaction history with the newest records first."
        actions={
          payload ? (
            <div className="transactionFeedActions">
              <span className="transactionFeedTotal">{formatNumber(payload.total)} transactions</span>
              <PaginationControls page={payload.page} totalPages={payload.totalPages} onPageChange={setPage} />
            </div>
          ) : null
        }
      >
        {loading && !payload ? (
          <LoadingSkeleton rows={8} />
        ) : error && !payload ? (
          <EmptyState
            title="Transaction feed unavailable"
            description="Retry once the public transaction endpoint responds."
          />
        ) : !payload?.items?.length ? (
          <EmptyState
            title="No transactions found"
            description="Transactions will appear here once indexed activity is available."
          />
        ) : (
          <VirtualizedTable
            ariaLabel="Transaction feed"
            columns={['Hash', 'Method / Type', 'From', 'To', 'Amount', 'Fee', 'Status', 'Age']}
            colWidths={['21%', '10%', '18%', '18%', '9%', '9%', '8%', '7%']}
            items={payload.items}
            rowHeight={96}
            maxHeight={620}
            renderRow={(transaction) => {
              const isEvm = Boolean(transaction.evmHash);
              const displayHash = transaction.evmHash || `0x${transaction.hash.toLowerCase()}`;
              const displayFrom = isEvm
                ? (transaction.evmFromAddress || transaction.fromAddress)
                : transaction.fromAddress;
              const displayTo = isEvm
                ? (transaction.evmToAddress || transaction.toAddress)
                : transaction.toAddress;
              return (
                <tr
                  key={transaction.hash}
                  {...getInteractiveRowProps({
                    onActivate: () => navigate(`/tx/${displayHash}`),
                    label: `Open transaction ${displayHash}`
                  })}
                >
                  <td data-label="Hash">
                    <CopyableValue value={displayHash} shortStart={8} shortEnd={6} />
                  </td>
                  <td data-label="Method">
                    <div className="tableCellStack">
                      <strong>{transaction.method}</strong>
                      <span>{transaction.txType}</span>
                    </div>
                  </td>
                  <td data-label="From">{displayFrom ? <CopyableValue value={displayFrom} shortStart={6} shortEnd={4} /> : '--'}</td>
                  <td data-label="To">{displayTo ? <CopyableValue value={displayTo} shortStart={6} shortEnd={4} /> : '--'}</td>
                  <td data-label="Amount">{transaction.amountDisplay}</td>
                  <td data-label="Fee">{transaction.feeDisplay}</td>
                  <td data-label="Status">
                    <StatusBadge tone={transaction.success ? 'success' : 'failed'}>
                      {transaction.status}
                    </StatusBadge>
                  </td>
                  <td data-label="Age">
                    <TimestampValue value={transaction.timestamp} compact />
                  </td>
                </tr>
              );
            }}
          />
        )}
      </Panel>
    </div>
  );
};

export default TransactionSearch;
