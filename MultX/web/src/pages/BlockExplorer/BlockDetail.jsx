import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchBlockDetailById } from '../../services/explorerDataService';
import {
  CopyableValue,
  EmptyState,
  ExplorerErrorState,
  LoadingSkeleton,
  PageHero,
  Panel,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import {
  classifyExplorerError,
  createNotFoundError,
  validateBlockRouteParam
} from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatBytes, formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

export const BlockDetail = () => {
  const { heightOrHash } = useParams();
  const navigate = useNavigate();
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta(
    block ? `Block #${block.height}` : 'Block Detail',
    defaultExplorerDescription
  );

  const loadBlock = useCallback(async () => {
    const validationError = validateBlockRouteParam(heightOrHash);

    if (validationError) {
      setBlock(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchBlockDetailById(heightOrHash);
      setBlock(data);
      setError(
        data
          ? null
          : createNotFoundError(
              'Block',
              'The requested height or block hash did not resolve on the current Kamet public endpoints.'
            )
      );
    } catch (loadError) {
      setBlock(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'block' }));
    } finally {
      setLoading(false);
    }
  }, [heightOrHash]);

  useEffect(() => {
    setLoading(true);
    loadBlock();
  }, [loadBlock]);

  const currentHeight = Number(block?.height || 0);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Block Detail"
        title={block ? `Block #${formatNumber(block.height)}` : 'Block'}
        description="Inspect block metadata, proposer details, gas accounting, and included transactions."
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/blocks')}>
              Back to Blocks
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate(`/block/${Math.max(1, currentHeight - 1)}`)}
              disabled={!currentHeight || currentHeight <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate(`/block/${currentHeight + 1}`)}
              disabled={!currentHeight}
            >
              Next
            </button>
          </>
        }
      />

      {error && !block ? <ExplorerErrorState error={error} onRetry={loadBlock} /> : null}

      {loading && !block ? (
        <Panel title="Loading block">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !block && !error ? (
        <EmptyState
          title="Block not found"
          description="The requested height or block hash did not resolve on the current Kamet public endpoints."
        />
      ) : block ? (
        <>
          <div className="explorerGrid two-up">
            <Panel title="Overview">
              <div className="detailList">
                <div className="detailRow">
                  <span>Height</span>
                  <strong>{formatNumber(block.height)}</strong>
                </div>
                <div className="detailRow">
                  <span>Status</span>
                  <StatusBadge tone="success">{block.status}</StatusBadge>
                </div>
                <div className="detailRow">
                  <span>Timestamp</span>
                  <TimestampValue value={block.timestamp} />
                </div>
                <div className="detailRow">
                  <span>Tx Count</span>
                  <strong>{formatNumber(block.txCount)}</strong>
                </div>
                <div className="detailRow">
                  <span>Gas Used</span>
                  <strong>{formatNumber(block.gasUsed)}</strong>
                </div>
                <div className="detailRow">
                  <span>Gas Limit</span>
                  <strong>{formatNumber(block.gasLimit)}</strong>
                </div>
                <div className="detailRow">
                  <span>Size</span>
                  <strong>{formatBytes(block.size)}</strong>
                </div>
                <div className="detailRow">
                  <span>Proposer</span>
                  {block.proposerAddress ? (
                    <CopyableValue
                      value={block.proposerAddress}
                      href={`/validator/${block.proposerAddress}`}
                    />
                  ) : (
                    <span>{block.proposerMoniker || '--'}</span>
                  )}
                </div>
              </div>
            </Panel>

            <Panel title="Hashes">
              <div className="detailList">
                <div className="detailRow multiLine">
                  <span>Block Hash</span>
                  <CopyableValue value={block.hash} preserve />
                </div>
                <div className="detailRow multiLine">
                  <span>Parent Hash</span>
                  <CopyableValue value={block.parentHash || '--'} preserve />
                </div>
                <div className="detailRow">
                  <span>Exact Time</span>
                  <span>{block.exactTime ? new Date(block.exactTime).toISOString() : '--'}</span>
                </div>
                <div className="detailRow">
                  <span>Age</span>
                  <span>{block.relativeTime}</span>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Included Transactions" description="Transactions committed in this block.">
            {!block.transactions?.length ? (
              <EmptyState
                title="No transactions in this block"
                description="This block committed without user transactions."
              />
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Hash</th>
                      <th>Method</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.transactions.map((transaction) => (
                      <tr
                        key={transaction.hash}
                        {...getInteractiveRowProps({
                          onActivate: () =>
                            navigate(`/tx/${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`),
                          label: `Open transaction ${transaction.evmHash || `0x${transaction.hash.toLowerCase()}`}`
                        })}
                      >
                        <td>
                          <CopyableValue value={transaction.evmHash || `0x${transaction.hash.toLowerCase()}`} />
                        </td>
                        <td>{transaction.method}</td>
                        <td>
                          {transaction.fromAddress ? (
                            <CopyableValue value={transaction.fromAddress} />
                          ) : (
                            '--'
                          )}
                        </td>
                        <td>
                          {transaction.toAddress ? <CopyableValue value={transaction.toAddress} /> : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
};

export default BlockDetail;
