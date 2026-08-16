import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { KAMET_LITHIC_EXAMPLES } from '../../data/kametRegistry';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchTokenCatalog } from '../../services/explorerDataService';
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
  VirtualizedTable
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatTokenAmount } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const tokenTabs = [
  { id: 'all', label: 'All' },
  { id: 'fungible', label: 'Fungible' },
  { id: 'lep100', label: 'LEP100 / Native' },
  { id: 'nft', label: 'NFT' }
];
const tokenTabIdBase = 'token-filter';

export const Tokens = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Tokens', defaultExplorerDescription);

  const loadTokens = useCallback(async () => {
    try {
      // Phase 1: fast load without activity stats — shows catalog immediately
      const baseData = await fetchTokenCatalog({ filter, includeActivity: false });
      setTokens(baseData);
      setError(null);
    } catch (loadError) {
      setError(classifyExplorerError(loadError, { resourceLabel: 'token catalog' }));
    } finally {
      setLoading(false);
    }

    // Phase 2: background enrichment — fills in holders/transfer counts when EVM log scan completes
    try {
      const enriched = await Promise.race([
        fetchTokenCatalog({ filter, includeActivity: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('activity timeout')), 15_000))
      ]);
      setTokens(enriched);
    } catch {
      // timed out or failed — base catalog already visible, silently skip enrichment
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadTokens();
  }, [loadTokens]);

  const coverage = useMemo(() => {
    const verifiedAssets = tokens.filter((token) => token.verified).length;
    const chainNativeAssets = tokens.filter(
      (token) => ['native', 'lep100'].includes(String(token.type || '').toLowerCase())
    ).length;
    const nftAssets = tokens.filter((token) => String(token.type || '').toLowerCase() === 'nft').length;

    return {
      visibleAssets: tokens.length,
      verifiedAssets,
      chainNativeAssets,
      nftAssets
    };
  }, [tokens]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Tokens"
        description="Browse native, LEP100, and surfaced NFT token contracts on Kamet, with full on-chain ownership replay for cataloged tokens before falling back to recent public transfer activity."
        actions={
          <button type="button" className="secondary-btn" onClick={() => navigate('/contracts')}>
            Browse Contracts
          </button>
        }
      />

      <div className="explorerStats compact explorerStats-four">
        <MetricCard
          label="Visible Assets"
          value={coverage.visibleAssets}
          subtext={filter === 'all' ? 'Current catalog view' : `Assets in ${filter} view`}
        />
        <MetricCard
          label="Verified Assets"
          value={coverage.verifiedAssets}
          subtext="Repo or API-backed verification"
        />
        <MetricCard
          label="LEP100 / Native"
          value={coverage.chainNativeAssets}
          subtext="Currently browsable chain-native assets"
        />
        <MetricCard
          label="NFT Inventory"
          value={coverage.nftAssets}
          subtext="Cataloged NFT collections in the current view"
          tone={coverage.nftAssets ? 'success' : 'info'}
        />
      </div>

      {error ? <ExplorerErrorState error={error} onRetry={loadTokens} /> : null}

      <Panel title="Token Filters" description="Filter fungible, NFT, and chain-native / LEP100 assets.">
        <DataTabs
          tabs={tokenTabs}
          activeTab={filter}
          onChange={setFilter}
          idBase={tokenTabIdBase}
          label="Token filters"
        />
      </Panel>

      <div
        id={`${tokenTabIdBase}-panel-${filter}`}
        className="tabPanelContent"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`${tokenTabIdBase}-tab-${filter}`}
      >
        {filter === 'nft' ? (
          <SectionMessage tone="info">
            NFT browsing follows the combined Kamet token catalog. Holder and inventory views use indexed ownership when available and otherwise replay on-chain transfer history for surfaced NFT contracts.
          </SectionMessage>
        ) : null}

        <Panel
          title="Lithic Source Examples"
          description="Source-only Lithic FT and NFT examples for client review. These live in the contracts folder but are not deployed Kamet contracts until real 0x addresses exist."
        >
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Class</th>
                  <th>Standard</th>
                  <th>Runtime</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {KAMET_LITHIC_EXAMPLES.map((example) => (
                  <tr key={example.id}>
                    <td>
                      <div className="tableCellStack">
                        <strong>{example.name}</strong>
                        <span>{example.symbol}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={example.assetClass === 'NFT' ? 'neutral' : 'success'}>
                        {example.assetClass}
                      </StatusBadge>
                    </td>
                    <td>{example.standard}</td>
                    <td>{example.runtime}</td>
                    <td>
                      <code>{example.sourcePath}</code>
                    </td>
                    <td>
                      <StatusBadge tone={example.verified ? 'success' : 'info'}>{example.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Token Catalog" description="Token metadata and contract links sourced from the latest Kamet deployment data and live contract metadata.">
          {loading && !tokens.length ? (
            <LoadingSkeleton rows={6} />
          ) : !tokens.length ? (
            <EmptyState
              title={filter === 'nft' ? 'No NFT contracts found' : 'No tokens found'}
              description={
                filter === 'nft'
                  ? 'No NFT collections were surfaced by the current Kamet token catalog or explorer API.'
                  : 'No token data matched the selected filter.'
              }
            />
          ) : (
            <VirtualizedTable
              ariaLabel="Token catalog"
              columns={['Token', 'Type', 'Total Supply', 'Holders', 'Transfers', 'Contract Address', 'Verification']}
              items={tokens}
              rowHeight={96}
              maxHeight={620}
              renderRow={(token) => (
                <tr
                  key={token.contractAddress || token.id || token.symbol}
                  {...getInteractiveRowProps({
                    onActivate: () => navigate(`/token/${token.contractAddress || 'native'}`),
                    label: `Open token ${token.symbol || token.name || token.contractAddress || 'native'}`
                  })}
                >
                  <td>
                    <div className="tableCellStack">
                      <strong>{token.symbol}</strong>
                      <span>{token.name}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={token.type === 'native' ? 'info' : 'success'}>
                      {token.type}
                    </StatusBadge>
                  </td>
                  <td>
                    {token.totalSupply ? formatTokenAmount(token.totalSupply, token.decimals || 18) : 'Indexing'}
                  </td>
                  <td>{token.holders ?? token.holdersObservedCount ?? 'Indexing'}</td>
                  <td>{token.transfers ?? token.transfersObservedCount ?? 'Indexing'}</td>
                  <td>
                    {token.contractAddress ? <CopyableValue value={token.contractAddress} /> : <span>Native asset</span>}
                  </td>
                  <td>
                    <StatusBadge tone={token.verified ? 'success' : 'neutral'}>
                      {token.verified ? 'Verified' : 'Unverified'}
                    </StatusBadge>
                  </td>
                </tr>
              )}
            />
          )}
        </Panel>
      </div>
    </div>
  );
};

export default Tokens;
