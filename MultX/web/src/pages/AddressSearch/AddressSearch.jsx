import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchAddressesLandingData } from '../../services/explorerDataService';
import GlobalSearchForm from '../../components/explorer/GlobalSearchForm';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  PageHero,
  Panel,
  StatusBadge
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import '../../scss/pages/Explorer/explorerPage.scss';

export const AddressSearch = () => {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Addresses', defaultExplorerDescription);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await fetchAddressesLandingData();
      setPayload(data);
      setError(null);
    } catch (loadError) {
      setPayload(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'address explorer' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow={CHAIN_CONFIG.networkLabel}
        title="Addresses"
        description="Search wallet, account, and contract addresses. The detail page automatically switches into contract mode when bytecode is detected."
      />

      <Panel title="Address Lookup" description="Paste a bech32 or 0x address to open the canonical detail page.">
        <GlobalSearchForm placeholder="Search litho1..., 0x..., validator operator, token symbol, or contract" />
      </Panel>

      {error ? <ExplorerErrorState error={error} onRetry={loadAddresses} /> : null}

      <div className="explorerGrid two-up">
        <Panel title="Supported Address Modes">
          <div className="searchCoverageList">
            <StatusBadge tone="success">wallet balances</StatusBadge>
            <StatusBadge tone="success">token balances</StatusBadge>
            <StatusBadge tone="success">recent transactions</StatusBadge>
            <StatusBadge tone="success">token transfers</StatusBadge>
            <StatusBadge tone="success">observed asset activity</StatusBadge>
            <StatusBadge tone="success">contract interactions</StatusBadge>
            <StatusBadge tone="info">internal txs when indexed</StatusBadge>
            <StatusBadge tone="info">nft ownership when indexed</StatusBadge>
          </div>
        </Panel>

        <Panel title="Address Formats">
          <div className="detailList">
            <div className="detailRow">
              <span>Cosmos account</span>
              <code>litho1...</code>
            </div>
            <div className="detailRow">
              <span>Lithosphere address</span>
              <code>0x...</code>
            </div>
            <div className="detailRow">
              <span>Validator operator</span>
              <code>{CHAIN_CONFIG.validatorPrefix}1...</code>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Recent Addresses" description="Recent participants observed in the public transaction window.">
        {loading && !payload ? (
          <LoadingSkeleton rows={6} />
        ) : !payload?.recentAddresses?.length ? (
          <EmptyState title="No recent addresses" description="Recent address activity will appear here after public transactions are loaded." />
        ) : (
          <div className="addressChipGrid">
            {payload.recentAddresses.map((address) => (
              <Link key={address} to={`/address/${address}`} className="addressChip">
                <CopyableValue value={address} />
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AddressSearch;
