import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchAddressPageData } from '../../services/explorerDataService';
import { useDotLithoName } from '../../hooks/useDotLithoName';
import {
  CopyableValue,
  DataTabs,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  SectionMessage,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import {
  classifyExplorerError,
  createNotFoundError,
  validateAddressRouteParam
} from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const tabDefinitions = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'token-transfers', label: 'Token Transfers' },
  { id: 'assets', label: 'NFTs / LEP100 Assets' },
  { id: 'contract', label: 'Contract' },
  { id: 'analytics', label: 'Analytics' }
];
const addressTabIdBase = 'address-activity';

const TransactionTable = ({ transactions = [], onOpenTransaction }) => {
  if (!transactions.length) {
    return <EmptyState title="No recent transactions" description="No recent public transactions matched this address." />;
  }

  return (
    <div className="tableWrap">
      <table className="dataTable">
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
          {transactions.map((transaction) => (
            <tr
              key={transaction.hash}
              {...getInteractiveRowProps({
                onActivate: () =>
                  onOpenTransaction(`/tx/${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`),
                label: `Open transaction ${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`
              })}
            >
              <td>
                <CopyableValue value={transaction.evmHash || `0x${transaction.hash.toLowerCase()}`} />
              </td>
              <td>{transaction.method}</td>
              <td>{transaction.fromAddress ? <CopyableValue value={transaction.fromAddress} /> : '--'}</td>
              <td>{transaction.toAddress ? <CopyableValue value={transaction.toAddress} /> : '--'}</td>
              <td>{transaction.amountDisplay}</td>
              <td>
                <StatusBadge tone={transaction.success ? 'success' : 'failed'}>
                  {transaction.status}
                </StatusBadge>
              </td>
              <td>
                <TimestampValue value={transaction.timestamp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TokenTransferTable = ({ transfers = [] }) => {
  if (!transfers.length) {
    return (
      <EmptyState
        title="No token transfers"
        description="Token transfer history is empty or still indexing for this address."
      />
    );
  }

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>Tx Hash</th>
            <th>Token</th>
            <th>Direction</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={`${transfer.txHash}-${transfer.tokenAddress}-${transfer.amount}`}>
              <td>
                <CopyableValue value={transfer.txHash} />
              </td>
              <td>
                <Link to={`/token/${transfer.tokenAddress}`}>{transfer.tokenSymbol}</Link>
              </td>
              <td>
                <StatusBadge tone={transfer.direction === 'in' ? 'success' : 'neutral'}>
                  {transfer.direction}
                </StatusBadge>
              </td>
              <td>{transfer.fromAddress ? <CopyableValue value={transfer.fromAddress} /> : '--'}</td>
              <td>{transfer.toAddress ? <CopyableValue value={transfer.toAddress} /> : '--'}</td>
              <td>{transfer.amountDisplay}</td>
              <td>
                <TimestampValue value={transfer.timestamp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InternalTransactionTable = ({ transactions = [], supported = false, onOpenTransaction }) => {
  if (!supported) {
    return (
      <EmptyState
        title="Internal transactions unavailable"
        description="The current public RPC and indexed explorer endpoints did not expose internal trace data for this address."
      />
    );
  }

  if (!transactions.length) {
    return (
      <EmptyState
        title="No internal transactions"
        description="No indexed internal transactions were returned for this address."
      />
    );
  }

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>Hash</th>
            <th>Type</th>
            <th>From</th>
            <th>To</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const transactionHref = transaction.hash ? `/tx/${transaction.hash}` : '';

            return (
              <tr
                key={`${transaction.hash || 'internal'}-${transaction.timestamp}-${transaction.fromAddress}-${transaction.toAddress}`}
                {...(transactionHref
                  ? getInteractiveRowProps({
                      onActivate: () => onOpenTransaction(transactionHref),
                      label: `Open internal transaction ${transaction.hash}`
                    })
                  : {})}
              >
                <td>{transaction.hash ? <CopyableValue value={transaction.hash} /> : '--'}</td>
                <td>{transaction.method || 'Internal transfer'}</td>
                <td>{transaction.fromAddress ? <CopyableValue value={transaction.fromAddress} /> : '--'}</td>
                <td>{transaction.toAddress ? <CopyableValue value={transaction.toAddress} /> : '--'}</td>
                <td>{transaction.amountDisplay || '--'}</td>
                <td>
                  <StatusBadge tone={transaction.success ? 'success' : 'failed'}>
                    {transaction.status}
                  </StatusBadge>
                </td>
                <td>{transaction.timestamp ? <TimestampValue value={transaction.timestamp} /> : '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AssetActivityGrid = ({ assets = [], nftMode = false }) => {
  if (!assets.length) {
    return (
      <EmptyState
        title={nftMode ? 'No NFTs indexed' : 'No assets detected'}
        description={
          nftMode
            ? 'No NFT inventory was detected for this address from indexed ownership data or on-chain catalog replay.'
            : 'No known balances or observed token-transfer activity were returned for this address.'
        }
      />
    );
  }

  return (
    <div className="tokenBalanceGrid">
      {assets.map((asset) => {
        const cardContent = (
          <>
            <div className="validatorMiniHeader">
              <strong>{asset.symbol || asset.name}</strong>
              <StatusBadge tone={asset.verified ? 'success' : 'neutral'}>
                {asset.kind === 'nft' ? 'NFT' : asset.type || 'Asset'}
              </StatusBadge>
            </div>
            <span>{asset.name}</span>
            <span>{asset.balanceDisplay || 'Observed activity'}</span>
            <span>
              {asset.transferCount
                ? `${formatNumber(asset.transferCount)} transfer(s) observed`
                : asset.kind === 'nft'
                  ? 'Indexed inventory record'
                  : 'No recent transfers observed'}
            </span>
            {asset.lastTransferAt ? (
              <TimestampValue value={asset.lastTransferAt} />
            ) : (
              <span>{asset.kind === 'nft' ? 'No recent transfer timestamp' : 'No recent transfer timestamp'}</span>
            )}
          </>
        );

        return asset.route ? (
          <Link
            key={`${asset.contractAddress || asset.symbol}-${asset.tokenId || 'asset'}`}
            to={asset.route}
            className="tokenBalanceCard"
          >
            {cardContent}
          </Link>
        ) : (
          <div
            key={`${asset.contractAddress || asset.symbol}-${asset.tokenId || 'asset'}`}
            className="tokenBalanceCard"
          >
            {cardContent}
          </div>
        );
      })}
    </div>
  );
};

export const AddressPage = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');
  const dotLithoName = useDotLithoName(address);

  usePageMeta(
    dotLithoName
      ? `${dotLithoName} · Address`
      : address ? `Address ${address}` : 'Address Detail',
    defaultExplorerDescription
  );

  const loadAddress = useCallback(async () => {
    const validationError = validateAddressRouteParam(address);

    if (validationError) {
      setPayload(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchAddressPageData(address);
      setPayload(data);
      setError(
        data
          ? null
          : createNotFoundError(
              'Address',
              'The requested address did not resolve on the current public endpoints.'
            )
      );
      if (data?.mode === 'contract') {
        setActiveTab('contract');
      }
    } catch (loadError) {
      setPayload(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'address' }));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    setLoading(true);
    loadAddress();
  }, [loadAddress]);

  // Reverse-resolution handled by useDotLithoName hook above.

  const tabs = useMemo(
    () =>
      tabDefinitions.map((tab) =>
        tab.id === 'assets'
          ? {
              ...tab,
              disabled: false
            }
          : tab
      ),
    []
  );
  const assetCoverage = payload?.assetCoverage || {
    observedAssets: 0,
    verifiedAssets: 0,
    lep100Assets: 0,
    nftAssets: 0
  };

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={
          dotLithoName
            ? `${payload?.mode === 'contract' ? 'Contract' : 'Address'} · ${dotLithoName}`
            : payload?.mode === 'contract' ? 'Contract Mode' : 'Address Detail'
        }
        title={
          dotLithoName
            ? dotLithoName
            : address ? `${address.slice(0, 12)}...${address.slice(-6)}` : 'Address'
        }
        description={
          dotLithoName && address
            ? `Reverse-resolves to ${dotLithoName}. Balances, token transfers, contract interactions, and analytics for this Kamet address.`
            : 'Balances, token transfers, contract interactions, and analytics for a Kamet wallet or contract address.'
        }
        meta={
          dotLithoName && address ? (
            <CopyableValue value={address} />
          ) : null
        }
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/addresses')}>
              Back to Addresses
            </button>
            <button type="button" className="secondary-btn" onClick={() => loadAddress()}>
              Refresh
            </button>
          </>
        }
      />

      {error && !payload ? <ExplorerErrorState error={error} onRetry={loadAddress} /> : null}

      {loading && !payload ? (
        <Panel title="Loading address">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !payload && !error ? (
        <EmptyState title="Address not found" description="The requested address did not resolve on the current public endpoints." />
      ) : payload ? (
        <>
          <div className="explorerStats compact explorerStats-four">
            <MetricCard label="Current Balance" value={`${payload.nativeBalanceDisplay} LITHO`} subtext={payload.mode === 'contract' ? 'Contract account' : 'Wallet balance'} />
            <MetricCard label="Observed Assets" value={formatNumber(payload.assetActivity.length)} subtext="Balances plus observed token activity" />
            <MetricCard label="Transactions" value={formatNumber(payload.transactions.length)} subtext="Recent public activity" />
            <MetricCard
              label="Internal Txs"
              value={
                payload.internalTransactionsSupported
                  ? formatNumber(payload.internalTransactions.length)
                  : 'Unsupported'
              }
              subtext={
                payload.internalTransactionsSupported
                  ? 'Indexed or trace-derived internal transactions'
                  : 'Not exposed by the current public endpoints'
              }
              tone={payload.internalTransactionsSupported ? 'success' : 'info'}
            />
          </div>

          <div className="explorerGrid two-up">
            <Panel title="Address Identity">
              <div className="detailList">
                <div className="detailRow multiLine">
                  <span>Route Address</span>
                  <CopyableValue value={payload.address} preserve />
                </div>
                {payload.bech32Address ? (
                  <div className="detailRow multiLine">
                    <span>Cosmos Address (litho1)</span>
                    <CopyableValue value={payload.bech32Address} preserve />
                  </div>
                ) : null}
                {payload.hexAddress ? (
                  <div className="detailRow multiLine">
                    <span>Lithosphere Address (0x)</span>
                    <CopyableValue value={payload.hexAddress} preserve />
                  </div>
                ) : null}
                <div className="detailRow">
                  <span>Mode</span>
                  <StatusBadge tone={payload.mode === 'contract' ? 'info' : 'success'}>
                    {payload.mode}
                  </StatusBadge>
                </div>
                {payload.account ? (
                  <>
                    <div className="detailRow">
                      <span>Account Number</span>
                      <strong>{payload.account.account_number || '--'}</strong>
                    </div>
                    <div className="detailRow">
                      <span>Sequence</span>
                      <strong>{payload.account.sequence || '--'}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </Panel>

            <Panel title="Balances">
              {!payload.balances.length && !payload.tokenBalances.length ? (
                <EmptyState title="No balances" description="No public balances were returned for this address." />
              ) : (
                <div className="detailList">
                  {payload.balances.map((balance) => (
                    <div key={`${balance.denom}-${balance.amount}`} className="detailRow">
                      <span>{balance.denom}</span>
                      <strong>{balance.amount}</strong>
                    </div>
                  ))}
                  {payload.tokenBalances.map((token) => (
                    <div key={`${token.contractAddress}-${token.balance}`} className="detailRow">
                      <span>{token.symbol}</span>
                      <strong>{token.balanceDisplay}</strong>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Activity Tabs">
            <DataTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              idBase={addressTabIdBase}
              label="Address activity tabs"
            />

            <div
              id={`${addressTabIdBase}-panel-${activeTab}`}
              className="tabPanelContent"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`${addressTabIdBase}-tab-${activeTab}`}
            >
              {activeTab === 'transactions' ? (
                <>
                  <TransactionTable
                    transactions={payload.transactions}
                    onOpenTransaction={(href) => navigate(href)}
                  />

                  <div className="explorerSectionTitle">Internal Transactions</div>
                  <InternalTransactionTable
                    transactions={payload.internalTransactions}
                    supported={payload.internalTransactionsSupported}
                    onOpenTransaction={(href) => navigate(href)}
                  />
                </>
              ) : null}

              {activeTab === 'token-transfers' ? (
                <>
                  <SectionMessage tone="info">
                    Recent token transfer activity is derived from public LEP100 transfer logs. It complements the asset view even when current balances are zero.
                  </SectionMessage>
                  <TokenTransferTable transfers={payload.tokenTransfers} />
                </>
              ) : null}

              {activeTab === 'assets' ? (
                <>
                  <SectionMessage tone="info">
                    LEP100 asset coverage now combines current balances, observed transfer activity, and full on-chain ownership replay for cataloged tokens. NFT inventory appears from indexed ownership data when available or from on-chain NFT transfer history for cataloged collections.
                  </SectionMessage>

                  <div className="explorerStats compact explorerStats-four">
                    <MetricCard
                      label="Observed Assets"
                      value={formatNumber(assetCoverage.observedAssets)}
                      subtext="Balances plus observed transfer activity"
                    />
                    <MetricCard
                      label="Verified Assets"
                      value={formatNumber(assetCoverage.verifiedAssets)}
                      subtext="Repo or API verified contracts"
                    />
                    <MetricCard
                      label="LEP100 Assets"
                      value={formatNumber(assetCoverage.lep100Assets)}
                      subtext="Known LEP100 balances or activity"
                    />
                    <MetricCard
                      label="NFT Inventory"
                      value={
                        payload.nftInventorySupported
                          ? formatNumber(assetCoverage.nftAssets)
                          : 'Indexing'
                      }
                      subtext={
                        payload.nftInventorySupported
                          ? 'Indexed or on-chain derived NFT inventory'
                          : 'No public NFT ownership source is currently available'
                      }
                      tone={payload.nftInventorySupported ? 'success' : 'info'}
                    />
                  </div>

                  <div className="explorerSectionTitle">Observed Asset Activity</div>
                  <AssetActivityGrid assets={payload.assetActivity} />

                  <div className="explorerSectionTitle">NFT Inventory</div>
                  {payload.nftInventorySupported ? (
                    <AssetActivityGrid assets={payload.nftAssets} nftMode />
                  ) : (
                    <EmptyState
                      title="NFT inventory unavailable"
                      description="No indexed NFT ownership payload or cataloged on-chain NFT collection was available for this address."
                    />
                  )}
                </>
              ) : null}

              {activeTab === 'contract' ? (
                <>
                  <SectionMessage tone="info">
                    {payload.mode === 'contract'
                      ? 'This address is running in contract mode. Recent contract calls are surfaced below from the public transaction window.'
                      : 'This address is a wallet on the public Lithosphere RPC, but recent contract interactions are still surfaced below when public transaction data is available.'}
                  </SectionMessage>

                  {payload.mode === 'contract' ? (
                    <div className="detailList">
                      <div className="detailRow">
                        <span>Contract View</span>
                        <button
                          type="button"
                          className="inlineLink"
                          onClick={() => navigate(`/contract/${payload.hexAddress || payload.address}`)}
                        >
                          Open contract page
                        </button>
                      </div>
                      <div className="detailRow">
                        <span>Interactions</span>
                        <strong>{formatNumber(payload.contractInteractions.length)}</strong>
                      </div>
                      <div className="detailRow">
                        <span>Token Profile</span>
                        {payload.tokenCandidate ? (
                          <button
                            type="button"
                            className="inlineLink"
                            onClick={() => navigate(`/token/${payload.tokenCandidate.address}`)}
                          >
                            {payload.tokenCandidate.symbol}
                          </button>
                        ) : (
                          <span>No known token ABI</span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {payload.contractInteractions.length ? (
                    <TransactionTable
                      transactions={payload.contractInteractions}
                      onOpenTransaction={(href) => navigate(href)}
                    />
                  ) : (
                    <EmptyState
                      title="No contract interactions"
                      description={
                        payload.mode === 'contract'
                          ? 'No recent public contract calls were observed for this contract address.'
                          : 'No recent public contract calls were observed for this wallet in the current transaction window.'
                      }
                    />
                  )}
                </>
              ) : null}

              {activeTab === 'analytics' ? (
                <div className="explorerStats">
                  <MetricCard
                    label="Recent Transactions"
                    value={formatNumber(payload.analytics.totalTransactions)}
                    subtext="Public recent window"
                  />
                  <MetricCard
                    label="Token Transfers"
                    value={formatNumber(payload.analytics.tokenTransfers)}
                    subtext="Observed LEP100 transfer events"
                  />
                  <MetricCard
                    label="Contract Interactions"
                    value={formatNumber(payload.contractInteractions.length)}
                    subtext="Transactions calling contracts"
                  />
                  <MetricCard
                    label="Internal Txs"
                    value={
                      payload.internalTransactionsSupported
                        ? formatNumber(payload.analytics.internalTransactions)
                        : 'Unsupported'
                    }
                    subtext={
                      payload.internalTransactionsSupported
                        ? 'Indexed or trace-derived internals'
                        : 'Internal traces unavailable'
                    }
                  />
                  <MetricCard
                    label="Observed Assets"
                    value={formatNumber(payload.analytics.observedAssets)}
                    subtext="Balances plus observed token activity"
                  />
                  <MetricCard
                    label="NFT Assets"
                    value={
                      payload.nftInventorySupported
                        ? formatNumber(payload.analytics.nftAssets)
                        : 'Indexing'
                    }
                    subtext={
                      payload.nftInventorySupported
                        ? 'Indexed or on-chain NFT inventory'
                        : 'NFT ownership not yet exposed'
                    }
                    tone={payload.nftInventorySupported ? 'success' : 'info'}
                  />
                  <MetricCard
                    label="Inbound"
                    value={`${payload.analytics.inboundTransfers} LITHO`}
                    subtext="Observed inbound volume"
                  />
                  <MetricCard
                    label="Outbound"
                    value={`${payload.analytics.outboundTransfers} LITHO`}
                    subtext="Observed outbound volume"
                  />
                  <MetricCard
                    label="Counterparties"
                    value={formatNumber(payload.analytics.uniqueCounterparties)}
                    subtext="Unique recent senders and recipients"
                  />
                </div>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
};

export default AddressPage;
