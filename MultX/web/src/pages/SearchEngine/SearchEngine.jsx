import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { useWallet } from '../../hooks/useWallet';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { fetchExplorerSummary } from '../../services/explorerDataService';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  FreshnessPill,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import GlobalSearchForm from '../../components/explorer/GlobalSearchForm';
import { formatCompactNumber, formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const HomeFeedTable = ({ blocks = [], onBlockClick }) => {
  if (!blocks.length) {
    return <EmptyState title="No recent blocks" description="Recent block data has not loaded yet." />;
  }

  return (
    <div className="tableWrap homeFeedTable">
      <table className="dataTable">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '54%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Height</th>
            <th>Timestamp</th>
            <th>Txs</th>
            <th>Proposer</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr
              key={block.hash || block.height}
              {...getInteractiveRowProps({
                onActivate: () => onBlockClick(block.height),
                label: `Open block ${block.height}`
              })}
            >
              <td data-label="Height">{formatNumber(block.height)}</td>
              <td data-label="Timestamp">
                <TimestampValue value={block.timestamp} compact />
              </td>
              <td data-label="Txs">{formatNumber(block.txCount)}</td>
              <td data-label="Proposer">
                {block.proposerAddress ? (
                  <CopyableValue
                    value={block.proposerAddress}
                    shortStart={12}
                    shortEnd={10}
                    href={`/validator/${block.proposerAddress}`}
                  />
                ) : (
                  <span>{block.proposerMoniker || '--'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const HomeTransactionTable = ({ transactions = [], onTransactionClick }) => {
  if (!transactions.length) {
    return (
      <EmptyState
        title="No recent transactions"
        description="No transactions in recent blocks."
      />
    );
  }

  return (
    <div className="tableWrap homeFeedTable">
      <table className="dataTable homeTransactionTable">
        <colgroup>
          <col style={{ width: '21%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Hash</th>
            <th>Method</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const href = `/tx/${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`;
            return (
              <tr
                key={transaction.hash}
                {...getInteractiveRowProps({
                  onActivate: () => onTransactionClick(href),
                  label: `Open transaction ${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`
                })}
              >
                <td data-label="Hash">
                  <CopyableValue
                    value={transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}
                    shortStart={10}
                    shortEnd={8}
                  />
                </td>
                <td data-label="Method">{transaction.method}</td>
                <td data-label="From">
                  {transaction.fromAddress ? (
                    <CopyableValue value={transaction.fromAddress} shortStart={10} shortEnd={8} />
                  ) : (
                    '--'
                  )}
                </td>
                <td data-label="To">
                  {transaction.toAddress ? (
                    <CopyableValue value={transaction.toAddress} shortStart={10} shortEnd={8} />
                  ) : (
                    '--'
                  )}
                </td>
                <td data-label="Amount">{transaction.amountDisplay}</td>
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
          })}
        </tbody>
      </table>
    </div>
  );
};

const TopValidators = ({ validators = [] }) => {
  if (!validators.length) {
    return <EmptyState title="No validator data" description="Validator data is still loading." />;
  }

  return (
    <div className="validatorMiniGrid">
      {validators.map((validator) => (
        <Link key={validator.operator_address} to={`/validator/${validator.operator_address}`} className="validatorMiniCard">
          <div className="validatorMiniHeader">
            <strong>{validator.moniker}</strong>
            <StatusBadge tone={validator.jailed ? 'failed' : 'success'}>
              {validator.statusLabel}
            </StatusBadge>
          </div>
          <div className="validatorMiniMeta">
            <span>Voting Power</span>
            <strong>{formatCompactNumber(Number(validator.tokens || 0) / 10 ** CHAIN_CONFIG.decimals)} LITHO</strong>
          </div>
          <div className="validatorMiniMeta">
            <span>Commission</span>
            <strong>{(Number(validator.commission?.commission_rates?.rate || 0) * 100).toFixed(2)}%</strong>
          </div>
        </Link>
      ))}
    </div>
  );
};

const SearchEngine = () => {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transportMode, setTransportMode] = useState('polling');

  usePageMeta('Home', defaultExplorerDescription);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchExplorerSummary();
      setSummary(data);
      setError(null);
    } catch (loadError) {
      setError(classifyExplorerError(loadError, { resourceLabel: 'explorer summary' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useRealtimeRefresh(
    async (mode) => {
      setTransportMode(mode);
      await loadSummary();
    },
    { enabled: true, pollInterval: 30_000 }
  );

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      wallet.disconnect();
      return;
    }

    await wallet.connect().catch(() => null);
  };

  const handleAddNetwork = async () => {
    await wallet.switchToLithoChain().catch(() => null);
  };

  const prefetchWallet = () => {
    void wallet.prefetch?.();
  };

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Kamet Explorer"
        description="Production-facing explorer for Kamet blocks, transactions, addresses, validators, tokens, contracts, and public network health."
        actions={
          <>
            <button type="button" className="primary-btn" onClick={() => navigate('/blocks')}>
              View Latest Blocks
            </button>
            <button type="button" className="secondary-btn" onClick={() => navigate('/transactions')}>
              View Latest Transactions
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleAddNetwork}
              onMouseEnter={prefetchWallet}
              onFocus={prefetchWallet}
              disabled={wallet.loading}
            >
              {wallet.loading ? 'Loading Wallet...' : 'Add Network'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleConnectWallet}
              onMouseEnter={prefetchWallet}
              onFocus={prefetchWallet}
              disabled={wallet.loading}
            >
              {wallet.loading ? 'Loading Wallet...' : wallet.isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
            </button>
          </>
        }
        meta={
          <div className="heroSearchPanel">
            <GlobalSearchForm
              placeholder="Search tx hash, block number, block hash, address, token, validator, or contract"
            />
            <div className="heroSearchMeta">
              <span>Chain ID {CHAIN_CONFIG.chainId}</span>
              <span>Lithosphere {CHAIN_CONFIG.evmChainId}</span>
            </div>
          </div>
        }
      />

      {summary ? (
        <FreshnessPill
          indexedThroughBlock={summary.indexedThroughBlock}
          lastUpdated={summary.lastUpdated}
          transport={transportMode}
          staleData={summary.staleData}
        />
      ) : null}

      {error ? <ExplorerErrorState error={error} onRetry={loadSummary} /> : null}

      <div className="explorerStats compact explorerStats-seven">
        <MetricCard
          label="Latest Block"
          value={summary ? formatNumber(summary.latestBlock) : '--'}
          subtext={summary ? <TimestampValue value={summary.latestBlockTime} /> : null}
          loading={loading}
          onClick={() => navigate('/blocks')}
        />
        <MetricCard
          label="Average Block Time"
          value={summary?.averageBlockTimeLabel || '--'}
          subtext="Recent sample"
          loading={loading}
        />
        <MetricCard label="TPS" value={summary?.tpsLabel || '--'} subtext="Recent monitored throughput" loading={loading} />
        <MetricCard label="Gas Price" value={summary?.gasPriceLabel || '--'} subtext="Current gas price" loading={loading} />
        <MetricCard
          label="Total Transactions"
          value={summary ? formatNumber(summary.totalTransactions) : '--'}
          subtext="Indexed transaction total"
          loading={loading}
        />
        <MetricCard
          label="Validator Count"
          value={summary ? formatNumber(summary.validatorCount) : '--'}
          subtext="Active public validators"
          loading={loading}
          onClick={() => navigate('/validators')}
        />
        <MetricCard
          label="Wallet Addresses"
          value={summary?.walletCount !== null && summary?.walletCount !== undefined ? formatNumber(summary.walletCount) : 'Indexing'}
          subtext={summary?.walletCountApproximate ? 'Observed active addresses' : 'Indexed wallet count'}
          loading={loading}
          tone={summary?.walletCountApproximate ? 'info' : 'default'}
        />
      </div>

      <div className="explorerGrid two-up-home">
        <Panel
          title="Latest Blocks"
          description="Recent blocks with proposer and gas usage."
          actions={
            <Link className="link-btn" to="/blocks">
              View all
            </Link>
          }
        >
          {loading && !summary ? (
            <LoadingSkeleton rows={5} />
          ) : (
            <HomeFeedTable
              blocks={summary?.latestBlocks || []}
              onBlockClick={(height) => navigate(`/block/${height}`)}
            />
          )}
        </Panel>

        <Panel
          title="Latest Transactions"
          description="Newest Kamet transactions."
          actions={
            <Link className="link-btn" to="/transactions">
              View all
            </Link>
          }
        >
          {loading && !summary ? (
            <LoadingSkeleton rows={5} />
          ) : (
            <HomeTransactionTable
              transactions={summary?.latestTransactions || []}
              onTransactionClick={(href) => navigate(href)}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Top Validators"
        description="Current active validators ranked by voting power."
        actions={
          <Link className="link-btn" to="/validators">
            Open validator list
          </Link>
        }
      >
        {loading && !summary ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <TopValidators validators={summary?.topValidators || []} />
        )}
      </Panel>

      <div className="explorerGrid two-up">
        <Panel title="Network Links">
          <div className="detailList">
            <div className="detailRow">
              <span>RPC</span>
              <CopyableValue value={CHAIN_CONFIG.rpcUrl} preserve />
            </div>
            <div className="detailRow">
              <span>REST</span>
              <CopyableValue value={CHAIN_CONFIG.restUrl} preserve />
            </div>
            <div className="detailRow">
              <span>Explorer</span>
              <a href={CHAIN_CONFIG.explorerUrl} target="_blank" rel="noreferrer">
                {CHAIN_CONFIG.explorerUrl}
              </a>
            </div>
            <div className="detailRow">
              <span>Status</span>
              <a href={CHAIN_CONFIG.statusPageUrl} target="_blank" rel="noreferrer">
                {CHAIN_CONFIG.statusPageUrl}
              </a>
            </div>
          </div>
        </Panel>

        <Panel title="Search Coverage" description="The global search routes known object types directly.">
          <div className="searchCoverageList">
            <StatusBadge tone="success">tx hash</StatusBadge>
            <StatusBadge tone="success">block number</StatusBadge>
            <StatusBadge tone="success">block hash</StatusBadge>
            <StatusBadge tone="success">wallet address</StatusBadge>
            <StatusBadge tone="success">contract address</StatusBadge>
            <StatusBadge tone="success">validator operator</StatusBadge>
            <StatusBadge tone="success">token symbol / contract</StatusBadge>
          </div>
          <div className="searchCoverageHint">
            Unknown or delayed objects fall back to the dedicated search results page with indexing and delay guidance.
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SearchEngine;
