import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KAMET_LITHIC_EXAMPLES } from '../../data/kametRegistry';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchContractsPage } from '../../services/explorerDataService';
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
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import '../../scss/pages/Explorer/explorerPage.scss';

export const Contracts = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta('Contracts', defaultExplorerDescription);

  const loadContracts = useCallback(async () => {
    try {
      const data = await fetchContractsPage();
      setContracts(data.items || []);
      setError(null);
    } catch (loadError) {
      setContracts([]);
      setError(classifyExplorerError(loadError, { resourceLabel: 'contract catalog' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Contract Explorer"
        title="Contracts"
        description="Repo-backed verified Kamet deployments and known token contracts, with direct deep links to ABI, events, and interaction panels."
      />

      {error ? <ExplorerErrorState error={error} onRetry={loadContracts} /> : null}

      <Panel
        title="Lithic Source Examples"
        description="Source-only Lithic FT and NFT examples for client review. These live in the contracts folder but are not deployed Kamet contracts until real 0x addresses exist."
      >
        <div className="tableWrap">
          <table className="dataTable">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Standard</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {KAMET_LITHIC_EXAMPLES.map((example) => (
                <tr key={example.id}>
                  <td data-label="Name">
                    <div className="tableCellStack">
                      <strong>{example.name}</strong>
                      <span>{example.symbol}</span>
                    </div>
                  </td>
                  <td data-label="Class">
                    <StatusBadge tone={example.assetClass === 'NFT' ? 'neutral' : 'success'}>
                      {example.assetClass}
                    </StatusBadge>
                  </td>
                  <td data-label="Standard">{example.standard}</td>
                  <td data-label="Source">
                    <code>{example.sourcePath}</code>
                  </td>
                  <td data-label="Status">
                    <div className="tableCellStack">
                      <StatusBadge tone="info">{example.status}</StatusBadge>
                      <span>{example.notes}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Known Contracts" description="Latest repo deployments and known Kamet contracts.">
        {loading && !contracts.length ? (
          <LoadingSkeleton rows={6} />
        ) : !contracts.length ? (
          <EmptyState title="No contracts found" description="No known contracts are available for this build." />
        ) : (
          <div className="tableWrap">
            <table className="dataTable">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '26%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Verification</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr
                    key={contract.address || contract.contractAddress}
                    {...getInteractiveRowProps({
                      onActivate: () => navigate(`/contract/${contract.address || contract.contractAddress}`),
                      label: `Open contract ${contract.name || contract.symbol || contract.address || contract.contractAddress}`
                    })}
                  >
                    <td data-label="Name">
                      <div className="tableCellStack">
                        <strong>{contract.name}</strong>
                        <span>{contract.symbol || 'Contract'}</span>
                      </div>
                    </td>
                    <td data-label="Type">
                      <StatusBadge tone={contract.type === 'bridge' ? 'info' : 'success'}>
                        {contract.type}
                      </StatusBadge>
                    </td>
                    <td data-label="Address">
                      <CopyableValue value={contract.address || contract.contractAddress} />
                    </td>
                    <td data-label="Verified">
                      <StatusBadge tone={contract.verified ? 'success' : 'neutral'}>
                        {contract.verified ? 'Verified' : 'Unverified'}
                      </StatusBadge>
                    </td>
                    <td data-label="Source">{contract.sourcePath || contract.deploymentSource || 'Live ABI only'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default Contracts;
