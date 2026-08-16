import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHAIN_CONFIG } from '../../config/api';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { fetchTokenPageData } from '../../services/explorerDataService';
import {
  CopyableValue,
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
  createExplorerError,
  validateTokenRouteParam
} from '../../helpers/explorerErrors';
import { getInteractiveRowProps } from '../../helpers/explorerInteraction';
import { formatTokenAmount } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Tokens/tokensPage.scss';

const isNftCollection = (token = {}) =>
  ['nft', 'erc721', 'erc1155', 'lep100-6'].includes(
    String(token?.type || token?.standard || '').toLowerCase()
  );

export const TokenDetail = () => {
  const { contract } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageMeta(token ? `${token.symbol}` : 'Token Detail', defaultExplorerDescription);

  const loadToken = useCallback(async () => {
    const validationError = validateTokenRouteParam(contract);

    if (validationError) {
      setToken(null);
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchTokenPageData(contract);
      setToken(data);
      setError(
        data
          ? null
          : createExplorerError('unsupported_object_type', {
              message:
                'This route expects `native` or a token / NFT contract. The requested address is not indexed as a Kamet asset.'
            })
      );
    } catch (loadError) {
      setToken(null);
      setError(classifyExplorerError(loadError, { resourceLabel: 'token' }));
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    setLoading(true);
    loadToken();
  }, [loadToken]);

  const nft = useMemo(() => isNftCollection(token), [token]);
  const collectionImage =
    token?.collectionMetadata?.image ||
    token?.image ||
    token?.nftPreviewTokens?.find((item) => item.image)?.image ||
    '';
  const collectionDescription =
    token?.collectionMetadata?.description || token?.description || '';

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Token Detail"
        title={token ? `${token.symbol}` : 'Token'}
        description={
          nft
            ? 'Review collection metadata, supply, token previews, transfer activity, contract address, and verification status.'
            : 'Review token metadata, supply, transfer activity, contract address, and verification status.'
        }
        actions={
          <>
            <button type="button" className="secondary-btn" onClick={() => navigate('/tokens')}>
              Back to Tokens
            </button>
            {token?.contractAddress ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate(`/contract/${token.contractAddress}`)}
              >
                Open Contract
              </button>
            ) : null}
          </>
        }
      />

      {error && !token ? <ExplorerErrorState error={error} onRetry={loadToken} /> : null}

      {loading && !token ? (
        <Panel title="Loading token">
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : !token && !error ? (
        <EmptyState
          title="Token not found"
          description="The requested contract did not resolve as a native asset, LEP100 token, or NFT collection."
        />
      ) : token ? (
        <>
          <div className="explorerStats compact tokenDetailStats">
            <MetricCard
              label={nft ? 'Minted Items' : 'Total Supply'}
              value={
                token.totalSupply
                  ? nft
                    ? token.totalSupply
                    : formatTokenAmount(token.totalSupply, token.decimals || 18)
                  : 'Indexing'
              }
              subtext="Live contract metadata"
            />
            <MetricCard
              label={nft ? 'Collectors' : 'Holders'}
              value={token.holders ?? (token.holdersObservedCount ? token.holdersObservedCount : 'Indexing')}
              subtext={
                token.holderSource === 'indexed'
                  ? 'Indexed holder count'
                  : token.holderSource === 'derived'
                    ? 'Derived from full on-chain transfer history'
                    : token.holders !== null && token.holders !== undefined
                      ? 'Observed holder count'
                      : token.holdersObservedCount
                        ? 'Observed recent transfer participants'
                        : 'Exact holder counts require token ownership history'
              }
            />
            <MetricCard
              label="Transfers"
              value={token.transfersCount ?? token.transfersObservedCount ?? 'Indexing'}
              subtext={
                token.transfersCount !== null && token.transfersCount !== undefined
                  ? token.holderSource === 'derived'
                    ? 'Derived from full on-chain transfer history'
                    : 'Indexed or observed transfer count'
                  : 'Recent public transfer logs'
              }
            />
            <MetricCard
              label="Verification"
              value={token.verificationStatus || (token.verified ? 'verified' : 'unverified')}
              subtext="Repo-backed or API-backed verification"
            />
          </div>

          <div className="explorerGrid two-up tokenDetailLayout">
            <Panel title="Metadata">
              <div className="detailList">
                <div className="detailRow">
                  <span>Name</span>
                  <strong>{token.name}</strong>
                </div>
                <div className="detailRow">
                  <span>Symbol</span>
                  <strong>{token.symbol}</strong>
                </div>
                <div className="detailRow">
                  <span>Type</span>
                  <StatusBadge tone={token.type === 'native' ? 'info' : nft ? 'neutral' : 'success'}>
                    {token.type}
                  </StatusBadge>
                </div>
                <div className="detailRow">
                  <span>Decimals</span>
                  <strong>{token.decimals}</strong>
                </div>
                <div className="detailRow multiLine">
                  <span>Contract Address</span>
                  {token.contractAddress ? (
                    <CopyableValue value={token.contractAddress} preserve />
                  ) : (
                    <span>Native asset</span>
                  )}
                </div>
                {token.collectionMetadataUri ? (
                  <div className="detailRow multiLine">
                    <span>Contract URI</span>
                    <CopyableValue value={token.collectionMetadataUri} preserve />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Verification">
              <div className="detailList">
                <div className="detailRow">
                  <span>Status</span>
                  <StatusBadge tone={token.verified ? 'success' : 'neutral'}>
                    {token.verified ? 'Verified' : 'Unverified'}
                  </StatusBadge>
                </div>
                <div className="detailRow">
                  <span>Discoverability</span>
                  <span>
                    Mirrors the latest repo deployment registry and live contract metadata.
                  </span>
                </div>
                <div className="detailRow">
                  <span>Chain</span>
                  <strong>{CHAIN_CONFIG.chainName}</strong>
                </div>
                {token.creator ? (
                  <div className="detailRow multiLine">
                    <span>Creator</span>
                    <CopyableValue value={token.creator} preserve />
                  </div>
                ) : null}
                {token.deploymentTimestamp ? (
                  <div className="detailRow">
                    <span>Deployed</span>
                    <TimestampValue value={token.deploymentTimestamp} />
                  </div>
                ) : null}
                {token.sourcePath ? (
                  <div className="detailRow multiLine">
                    <span>Source Path</span>
                    <code>{token.sourcePath}</code>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          {nft ? (
            <Panel
              title="Collection Preview"
              description="Collection-level metadata and recent token previews resolved from contractURI / tokenURI."
            >
              <div className="nftCollectionHero">
                {collectionImage ? (
                  <div className="nftCollectionImage">
                    <img src={collectionImage} alt={`${token.name} collection`} loading="lazy" />
                  </div>
                ) : null}

                <div className="nftCollectionCopy">
                  <div className="detailList">
                    <div className="detailRow">
                      <span>Collection Name</span>
                      <strong>{token.collectionMetadata?.name || token.name}</strong>
                    </div>
                    <div className="detailRow">
                      <span>Minted Items</span>
                      <strong>{token.totalSupply || '--'}</strong>
                    </div>
                    <div className="detailRow">
                      <span>Preview Tokens</span>
                      <strong>{token.nftPreviewTokens?.length || 0}</strong>
                    </div>
                  </div>

                  {collectionDescription ? (
                    <p className="nftCollectionDescription">{collectionDescription}</p>
                  ) : (
                    <SectionMessage tone="info">
                      This collection does not expose a description in its current metadata.
                    </SectionMessage>
                  )}
                </div>
              </div>

              {token.nftPreviewTokens?.length ? (
                <div className="nftPreviewGrid">
                  {token.nftPreviewTokens.map((item) => (
                    <div key={item.tokenId} className="nftPreviewCard">
                      <div className="nftPreviewArtwork">
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" />
                        ) : (
                          <div className="nftPreviewFallback">No artwork</div>
                        )}
                      </div>
                      <div className="nftPreviewMeta">
                        <strong>{item.name}</strong>
                        <span>Token #{item.tokenId}</span>
                        {item.description ? <small>{item.description}</small> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No NFT previews yet"
                  description="Recent token previews will appear here after Transfer activity exposes token IDs."
                />
              )}
            </Panel>
          ) : null}

          <Panel
            title="Recent Transfers"
            description={
              nft
                ? 'Recent public Transfer events for this collection.'
                : 'Recent public Transfer events for this contract.'
            }
          >
            {!token.recentTransfers?.length ? (
              <EmptyState
                title="No recent transfers"
                description="Recent token transfers are unavailable or still indexing for this contract."
              />
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Tx Hash</th>
                      <th>From</th>
                      <th>To</th>
                      <th>{nft ? 'Item' : 'Amount'}</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {token.recentTransfers.map((transfer) => (
                      <tr key={`${transfer.txHash}-${transfer.amount}-${transfer.blockHeight}`}>
                        <td>
                          <CopyableValue value={transfer.txHash} />
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
            )}
          </Panel>

          <Panel
            title={nft ? 'Current Holders' : 'Current Holders'}
            description={
              nft
                ? 'Indexed collection ownership when available, otherwise derived from full on-chain transfer history.'
                : 'Indexed token ownership when available, otherwise derived from full on-chain transfer history for the current token contract.'
            }
          >
            {!token.exactHolders?.length ? (
              <SectionMessage tone="info">
                Exact current holders are not yet available for this {nft ? 'collection' : 'token'}.
                The observed-holder panel below remains the current fallback.
              </SectionMessage>
            ) : (
              <>
                {token.holderSource === 'derived' ? (
                  <SectionMessage tone="info">
                    The public Kamet holder endpoint did not return ownership rows for this {nft ? 'collection' : 'token'}, so the table below was derived from full on-chain transfer history for the contract.
                  </SectionMessage>
                ) : null}
                <div className="tableWrap">
                  <table className="dataTable">
                    <thead>
                      <tr>
                        <th>Address</th>
                        <th>{nft ? 'Items' : 'Balance'}</th>
                        <th>Share</th>
                        <th>Transfers</th>
                        <th>Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {token.exactHolders.map((holder) => (
                        <tr
                          key={`indexed-${holder.address}`}
                          {...getInteractiveRowProps({
                            onActivate: () => navigate(`/address/${holder.address}`),
                            label: `Open address ${holder.address}`
                          })}
                        >
                          <td>
                            <CopyableValue value={holder.address} preserve />
                          </td>
                          <td>{holder.balanceDisplay}</td>
                          <td>{holder.share || '--'}</td>
                          <td>{holder.transfers || '--'}</td>
                          <td>{holder.lastSeen ? <TimestampValue value={holder.lastSeen} /> : '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Observed Holders"
            description={
              nft
                ? 'Recent collection participants observed in the public event window.'
                : 'Recent transfer participants observed in the public event window.'
            }
          >
            {token.holderSource === 'observed' || token.holderSource === 'unavailable' ? (
              <SectionMessage tone="info">
                Current holders could not be reconstructed for this {nft ? 'collection' : 'token'} from indexed or on-chain ownership sources. This panel shows recent public transfer participants instead.
              </SectionMessage>
            ) : token.exactHolders?.length ? (
              <SectionMessage tone="info">
                Current ownership is shown above. The table below still highlights recent active transfer participants for operational context.
              </SectionMessage>
            ) : null}

            {!token.observedHolders?.length ? (
              <EmptyState
                title="No observed holders yet"
                description="Exact holder counts still require indexed ownership data. Recent transfer participants will appear here when public token events are available."
              />
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Inbound</th>
                      <th>Outbound</th>
                      <th>Transfers</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {token.observedHolders.map((holder) => (
                      <tr
                        key={holder.address}
                        {...getInteractiveRowProps({
                          onActivate: () => navigate(`/address/${holder.address}`),
                          label: `Open address ${holder.address}`
                        })}
                      >
                        <td>
                          <CopyableValue value={holder.address} preserve />
                        </td>
                        <td>{holder.receivedCount}</td>
                        <td>{holder.sentCount}</td>
                        <td>{holder.transfers}</td>
                        <td>
                          <TimestampValue value={holder.lastSeen} />
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

export default TokenDetail;
