import axios from 'axios';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SelectedPageContext } from '../../context';
import { CHAIN_CONFIG, CosmosAPI } from '../../config/api';
import { useWallet } from '../../hooks/useWallet';
import { detectAddressType, formatRelativeTime, shortenMiddle, toBech32Address } from '../../helpers/explorer';
import {
  createInitialFaucetAvailability,
  probeFaucetClaimAvailability
} from '../../services/deploymentStatusService';
import { fetchAllValidators, getPublicValidators } from '../../services/validatorService';
import '../../scss/pages/Explorer/explorerPage.scss';
import '../../scss/pages/Settings/settingsPage.scss';

const MAX_LITHO_SUPPLY = 1_000_000_000;

const DEFAULT_FAUCET_ASSET = {
  id: 'native-litho',
  type: 'native',
  standard: 'native',
  name: 'Lithosphere',
  symbol: CHAIN_CONFIG.denom,
  description: 'Native Kamet gas token for wallet setup and test transactions.',
  contractAddress: '',
  claimMode: 'transfer',
  cooldownHours: 24,
  amountOptions: ['1', '2'],
  previewImage: '',
  collectionSize: 0
};

const normalizeFaucetAsset = (asset = {}) => ({
  id: String(asset.id || DEFAULT_FAUCET_ASSET.id).trim(),
  type: String(asset.type || DEFAULT_FAUCET_ASSET.type).trim().toLowerCase(),
  standard: String(asset.standard || DEFAULT_FAUCET_ASSET.standard).trim().toLowerCase(),
  name: String(asset.name || DEFAULT_FAUCET_ASSET.name).trim(),
  symbol: String(asset.symbol || DEFAULT_FAUCET_ASSET.symbol).trim(),
  description: String(asset.description || '').trim(),
  contractAddress: String(asset.contractAddress || '').trim(),
  claimMode: String(asset.claimMode || 'transfer').trim().toLowerCase(),
  cooldownHours: Number(asset.cooldownHours || DEFAULT_FAUCET_ASSET.cooldownHours),
  amountOptions: String(asset.claimMode || '').toLowerCase() === 'source-only'
    ? []
    : Array.isArray(asset.amountOptions) && asset.amountOptions.length
      ? asset.amountOptions.map((value) => String(value).trim()).filter(Boolean)
      : [...DEFAULT_FAUCET_ASSET.amountOptions],
  previewImage: String(asset.previewImage || '').trim(),
  collectionSize: Number(asset.collectionSize || 0)
});

const getDefaultSelectedAmount = (asset) => String(asset?.amountOptions?.[0] || '1');

const formatCompactBalance = (amount, decimals = CHAIN_CONFIG.decimals) => {
  const divisor = Math.pow(10, decimals);
  const value = Number(amount || 0) / divisor;

  if (!Number.isFinite(value) || value <= 0) {
    return '--';
  }

  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }

  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }

  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }

  return value.toFixed(2);
};

const formatSupplyCompactBalance = (amount, decimals = CHAIN_CONFIG.decimals) => {
  const divisor = Math.pow(10, decimals);
  const value = Number(amount || 0) / divisor;

  if (!Number.isFinite(value) || value <= 0) {
    return '--';
  }

  if (value >= MAX_LITHO_SUPPLY) {
    return '1B';
  }

  return formatCompactBalance(amount, decimals);
};

const formatCooldownLabel = (hours = 0) => {
  const normalizedHours = Number(hours || 0);

  if (!normalizedHours) {
    return 'No cooldown';
  }

  if (normalizedHours % 24 === 0) {
    const days = normalizedHours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  return `${normalizedHours} hour${normalizedHours === 1 ? '' : 's'}`;
};

const getAssetTypeLabel = (asset) => {
  if (asset.type === 'nft' || asset.type === 'lep100-6') {
    return 'NFT';
  }

  if (asset.type === 'lep100-2') {
    return 'FT';
  }

  if (asset.type === 'lep100') {
    return 'LEP100';
  }

  return 'Native';
};

const LITHO_SYMBOL = '\uD835\uDD43';

const getAssetActionLabel = (asset, amount) => {
  if (!asset) {
    return `Request ${LITHO_SYMBOL} ${amount} ${CHAIN_CONFIG.denom}`;
  }

  if (asset.claimMode === 'source-only') {
    return 'Source only';
  }

  if (asset.type === 'nft') {
    return `Mint ${asset.symbol}`;
  }

  const prefix = asset.type === 'native' ? `${LITHO_SYMBOL} ` : '';
  return `Request ${prefix}${amount} ${asset.symbol}`;
};

export const Settings = () => {
  const { setSelectedPage } = useContext(SelectedPageContext);
  const wallet = useWallet();

  const [claimAddress, setClaimAddress] = useState('');
  const [faucetAssets, setFaucetAssets] = useState([DEFAULT_FAUCET_ASSET]);
  const [faucetAssetsLoading, setFaucetAssetsLoading] = useState(true);
  const [faucetAssetsError, setFaucetAssetsError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_FAUCET_ASSET.id);
  const [selectedAmount, setSelectedAmount] = useState(getDefaultSelectedAmount(DEFAULT_FAUCET_ASSET));
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [claimResult, setClaimResult] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [faucetAvailability, setFaucetAvailability] = useState(createInitialFaucetAvailability());
  const [snapshot, setSnapshot] = useState({
    loading: true,
    latestHeight: 0,
    latestBlockTime: '',
    validatorCount: 0,
    totalSupply: '0',
    totalStaked: '0'
  });

  useEffect(() => {
    setSelectedPage('Faucet');
  }, [setSelectedPage]);

  useEffect(() => {
    if (wallet.isConnected && wallet.account && !claimAddress) {
      setClaimAddress(wallet.account);
    }
  }, [wallet.account, wallet.isConnected, claimAddress]);

  useEffect(() => {
    let mounted = true;

    const loadFaucetAssets = async () => {
      if (!CHAIN_CONFIG.faucetAssetsUrl) {
        if (mounted) {
          setFaucetAssets([DEFAULT_FAUCET_ASSET]);
          setFaucetAssetsLoading(false);
          setFaucetAssetsError('');
        }
        return;
      }

      try {
        const response = await fetch(CHAIN_CONFIG.faucetAssetsUrl);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.message ||
              payload?.error ||
              'Unable to load the live faucet asset catalog right now.'
          );
        }

        const assets = Array.isArray(payload?.assets)
          ? payload.assets.map((asset) => normalizeFaucetAsset(asset)).filter((asset) => asset.id)
          : [];

        if (!mounted) {
          return;
        }

        setFaucetAssets(assets.length ? assets : [DEFAULT_FAUCET_ASSET]);
        setFaucetAssetsError('');
      } catch (error) {
        if (!mounted) {
          return;
        }

        setFaucetAssets([DEFAULT_FAUCET_ASSET]);
        setFaucetAssetsError(
          error?.message ||
            'Unable to load the live faucet asset catalog. Falling back to native LITHO.'
        );
      } finally {
        if (mounted) {
          setFaucetAssetsLoading(false);
        }
      }
    };

    loadFaucetAssets();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!faucetAssets.length) {
      return;
    }

    const selectedAsset = faucetAssets.find((asset) => asset.id === selectedAssetId);
    const nextAsset = selectedAsset || faucetAssets[0];

    if (!selectedAsset) {
      setSelectedAssetId(nextAsset.id);
    }

    const nextAmount = getDefaultSelectedAmount(nextAsset);
    if (!nextAsset.amountOptions.includes(String(selectedAmount))) {
      setSelectedAmount(nextAmount);
    }
  }, [faucetAssets, selectedAssetId, selectedAmount]);

  useEffect(() => {
    let mounted = true;

    const loadFaucetAvailability = async () => {
      const nextState = await probeFaucetClaimAvailability();

      if (mounted) {
        setFaucetAvailability(nextState);
      }
    };

    loadFaucetAvailability();
    const interval = window.setInterval(loadFaucetAvailability, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchSnapshot = async () => {
      try {
        const [blockRes, validatorList, supplyRes] = await Promise.all([
          axios.get(CosmosAPI.latestBlockRest()).catch(() => null),
          fetchAllValidators().catch(() => null),
          axios.get(CosmosAPI.supplyByDenom(CHAIN_CONFIG.baseDenom)).catch(() => null)
        ]);

        if (!mounted) {
          return;
        }

        const nextState = {
          loading: false,
          latestHeight: 0,
          latestBlockTime: '',
          validatorCount: 0,
          totalSupply: '0',
          totalStaked: '0'
        };

        if (blockRes?.data?.block) {
          nextState.latestHeight = Number(blockRes.data.block.header?.height || 0);
          nextState.latestBlockTime = blockRes.data.block.header?.time || '';
        }

        if (validatorList) {
          const publicValidators = getPublicValidators(validatorList);
          nextState.validatorCount = publicValidators.length;
          nextState.totalStaked = String(
            publicValidators.reduce((sum, validator) => sum + Number(validator.tokens || 0), 0)
          );
        }

        if (supplyRes?.data?.amount?.amount) {
          nextState.totalSupply = supplyRes.data.amount.amount;
        }

        setSnapshot(nextState);
      } catch {
        if (mounted) {
          setSnapshot((current) => ({
            ...current,
            loading: false
          }));
        }
      }
    };

    fetchSnapshot();
    const interval = window.setInterval(fetchSnapshot, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const selectedAsset = useMemo(
    () => faucetAssets.find((asset) => asset.id === selectedAssetId) || faucetAssets[0] || DEFAULT_FAUCET_ASSET,
    [faucetAssets, selectedAssetId]
  );

  const addressType = detectAddressType(claimAddress);
  const liveStats = useMemo(
    () => [
      {
        label: 'Latest block',
        value: snapshot.loading ? '--' : snapshot.latestHeight.toLocaleString('en-US'),
        hint: snapshot.latestBlockTime ? formatRelativeTime(snapshot.latestBlockTime) : 'Waiting for data'
      },
      {
        label: 'Validators',
        value: snapshot.loading ? '--' : String(snapshot.validatorCount),
        hint: 'Current active set'
      },
      {
        label: 'Total staked',
        value: snapshot.loading ? '--' : `${LITHO_SYMBOL} ${formatCompactBalance(snapshot.totalStaked)} ${CHAIN_CONFIG.denom}`,
        hint: 'Bonded on Kamet'
      },
      {
        label: 'Total supply',
        value: snapshot.loading ? '--' : `${LITHO_SYMBOL} ${formatSupplyCompactBalance(snapshot.totalSupply)} ${CHAIN_CONFIG.denom}`,
        hint: 'On-chain supply'
      }
    ],
    [snapshot]
  );

  const networkSummary = useMemo(
    () => [
      {
        id: 'network-name',
        label: 'Network',
        value: CHAIN_CONFIG.chainName,
        helper: 'Wallet display name'
      },
      {
        id: 'chain-id',
        label: 'Cosmos Chain ID',
        value: CHAIN_CONFIG.chainId,
        helper: 'For Cosmos SDK tooling'
      },
      {
        id: 'evm-chain-id',
        label: 'Lithosphere Chain ID',
        value: String(CHAIN_CONFIG.evmChainId),
        helper: 'For browser wallets'
      },
      {
        id: 'latest-height',
        label: 'Latest Block',
        value: snapshot.loading ? '--' : snapshot.latestHeight.toLocaleString('en-US'),
        helper: snapshot.latestBlockTime ? formatRelativeTime(snapshot.latestBlockTime) : 'Live chain height'
      },
      {
        id: 'rpc-url',
        label: 'RPC URL',
        value: CHAIN_CONFIG.rpcUrl,
        helper: 'Primary RPC endpoint'
      },
      {
        id: 'rest-url',
        label: 'REST / LCD',
        value: CHAIN_CONFIG.restUrl,
        helper: 'Chain queries and explorer data'
      },
      {
        id: 'explorer-url',
        label: 'Explorer',
        value: CHAIN_CONFIG.explorerUrl,
        helper: 'Public Kamet explorer'
      },
      {
        id: 'currency-symbol',
        label: 'Currency Symbol',
        value: `${LITHO_SYMBOL} (${CHAIN_CONFIG.denom})`,
        helper: 'LITHO native token symbol'
      },
      {
        id: 'claim-api',
        label: 'Claim API',
        value: faucetAvailability.loading ? 'Checking...' : faucetAvailability.ready ? 'Available' : 'Unavailable',
        helper: faucetAvailability.message
      }
    ],
    [faucetAvailability, snapshot]
  );

  const addressGuidance = useMemo(() => {
    if (addressType === 'EVM') {
      return {
        title: 'Lithosphere address detected',
        message:
          'Use this address in your browser wallet. It is the right format for Lithosphere sends.'
      };
    }

    if (addressType === 'COSMOS') {
      return {
        title: 'Cosmos address detected',
        message:
          'Use this address with Keplr and Cosmos-native tools. Browser wallets will reject the bech32 format.'
      };
    }

    return {
      title: 'Paste a Kamet address',
      message:
        'Use a 0x address for browser wallets or a litho1 address for Cosmos-native tools and staking flows.'
    };
  }, [addressType]);

  const handleConnectWallet = async () => {
    try {
      setActionError('');
      await wallet.connect();
    } catch (error) {
      setActionError(error?.message || 'Unable to connect wallet right now.');
    }
  };

  const handleAddNetwork = async () => {
    try {
      setActionError('');
      await wallet.switchToLithoChain();
    } catch (error) {
      setActionError(error?.message || `Unable to add ${CHAIN_CONFIG.chainName} automatically.`);
    }
  };

  const handleUseConnectedWallet = () => {
    if (wallet.account) {
      setClaimAddress(wallet.account);
      setClaimResult(null);
    }
  };

  const prefetchWallet = () => {
    void wallet.prefetch?.();
  };

  const handleCopyValue = async (fieldId, value) => {
    try {
      setActionError('');
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldId);
      window.setTimeout(() => {
        setCopiedField((current) => (current === fieldId ? '' : current));
      }, 1600);
    } catch (error) {
      setActionError(error?.message || `Unable to copy ${fieldId} right now.`);
    }
  };

  const handleClaim = async (event) => {
    event.preventDefault();

    if (!addressType) {
      setClaimResult({
        type: 'error',
        message: 'Enter a valid 0x or litho1 address before requesting faucet assets.'
      });
      return;
    }

    if (faucetAvailability.loading) {
      setClaimResult({
        type: 'info',
        message: 'Checking live faucet availability. Try again in a few seconds.'
      });
      return;
    }

    if (!faucetAvailability.ready) {
      setClaimResult({
        type: 'info',
        message: faucetAvailability.message
      });
      return;
    }

    try {
      setSubmitting(true);
      setClaimResult(null);

      const response = await fetch(CHAIN_CONFIG.faucetClaimUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: claimAddress.trim(),
          amount: String(selectedAmount),
          assetId: selectedAsset.id,
          addressType
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Unable to request faucet assets right now.');
      }

      const submittedAmount =
        payload?.amount ||
        (selectedAsset.type === 'nft'
          ? `1 ${selectedAsset.symbol}`
          : `${selectedAmount} ${selectedAsset.symbol}`);

      setClaimResult({
        type: 'success',
        message: payload?.message || `${submittedAmount} request submitted successfully.`,
        txHash: payload?.txHash || payload?.tx_hash || payload?.hash || '',
        tokenId:
          payload?.tokenId !== undefined && payload?.tokenId !== null && payload?.tokenId !== ''
            ? String(payload.tokenId)
            : ''
      });
    } catch (error) {
      setClaimResult({
        type: 'error',
        message: error?.message || 'Unable to request faucet assets right now.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="explorerPage faucetPage">
      <div className="explorerHero faucetHero">
        <div className="explorerHero-copy faucetHeroCopy">
          <div className="explorerEyebrow">Kamet Testnet Faucet</div>
          <h1>Lithosphere Faucet</h1>
          <p>
            Add the Kamet network, verify live chain status, and request native LITHO, LEP100
            assets, or NFT demo items without leaving the explorer.
          </p>

          <div className="faucetHeroActions">
            {!wallet.isConnected ? (
              <button
                type="button"
                className="primary-btn faucetPrimaryAction"
                onClick={handleConnectWallet}
                onMouseEnter={prefetchWallet}
                onFocus={prefetchWallet}
                disabled={wallet.loading}
              >
                {wallet.loading ? 'Loading Wallet...' : 'Connect Wallet'}
              </button>
            ) : (
              <button type="button" className="faucetSecondaryAction" onClick={wallet.disconnect}>
                Disconnect Wallet
              </button>
            )}
            <button
              type="button"
              className="faucetSecondaryAction"
              onClick={handleAddNetwork}
              onMouseEnter={prefetchWallet}
              onFocus={prefetchWallet}
              disabled={wallet.loading}
            >
              {wallet.loading ? 'Loading Wallet...' : 'Add Kamet Network'}
            </button>
            <a
              href={CHAIN_CONFIG.setupGuideUrl}
              target="_blank"
              rel="noreferrer"
              className="faucetSecondaryAction"
            >
              Validator Guide
            </a>
          </div>

          {(faucetAvailability.loading || !faucetAvailability.ready) && (
            <div
              className={`faucetInlineNotice ${!faucetAvailability.loading && !faucetAvailability.ready ? 'warning' : ''}`}
            >
              {faucetAvailability.message}
            </div>
          )}
        </div>

        <div className="faucetLiveStats">
          {liveStats.map(({ label, value, hint }) => (
            <div key={label} className="faucetLiveStat">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
          ))}
        </div>
      </div>

      {actionError && <div className="explorerMessage error">{actionError}</div>}

      <div className="explorerGrid two-up faucetMainGrid">
        <div className="explorerPanel">
          <div className="faucetPanelHeader">
            <div>
              <div className="explorerSectionTitle">Request Faucet Assets</div>
              <p className="panelLead">
                Use a real Kamet wallet address. If you connect a browser wallet, the explorer can
                autofill the address for you.
              </p>
            </div>

            {wallet.isConnected && wallet.account && claimAddress.trim() !== wallet.account && (
              <button type="button" className="inlineLink" onClick={handleUseConnectedWallet}>
                Use connected wallet
              </button>
            )}
          </div>

          {wallet.isConnected && wallet.account && (
            <div className="faucetConnectedCard">
              <div className="faucetConnectedIdentity">
                <span className="faucetConnectedLabel">Connected wallet</span>
                <strong>{shortenMiddle(wallet.account, 10, 4)}</strong>
              </div>
              <button type="button" className="faucetMiniButton" onClick={handleUseConnectedWallet}>
                Autofill
              </button>
            </div>
          )}

          <form className="faucetClaimForm" onSubmit={handleClaim}>
            <div className="fieldLabelRow">
              <label className="fieldLabel" htmlFor="faucet-address">
                Wallet Address
              </label>
              <span className="fieldHint">
                {faucetAvailability.ready
                  ? wallet.isConnected
                    ? 'Connected wallet available'
                    : 'Paste any Kamet address'
                  : 'Claims are paused until the live faucet passes readiness checks'}
              </span>
            </div>

            <input
              id="faucet-address"
              type="text"
              value={claimAddress}
              onChange={(event) => setClaimAddress(event.target.value)}
              placeholder="Enter a 0x or litho1 address"
              className="faucetInput"
            />

            <div className="addressInsightCard">
              <div className="addressInsightHeader">
                <span className={`addressBadge ${addressType ? 'active' : ''}`}>
                  {addressType || 'Address type pending'}
                </span>
                <strong>{addressGuidance.title}</strong>
              </div>
              <span className="addressHelp">{addressGuidance.message}</span>
            </div>

            <div className="fieldLabelRow">
              <div className="fieldLabel">Asset</div>
              <span className="fieldHint">
                {faucetAssetsLoading
                  ? 'Loading live faucet catalog...'
                  : `${faucetAssets.length} asset${faucetAssets.length === 1 ? '' : 's'} available`}
              </span>
            </div>

            {faucetAssetsError ? (
              <div className="faucetInlineNotice warning">{faucetAssetsError}</div>
            ) : null}

            <div className="faucetAssetGrid">
              {faucetAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`faucetAssetCard ${selectedAsset.id === asset.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setSelectedAmount(getDefaultSelectedAmount(asset));
                    setClaimResult(null);
                  }}
                >
                  <div className="faucetAssetCardTop">
                    <span className={`faucetAssetType faucetAssetType-${asset.type}`}>
                      {getAssetTypeLabel(asset)}
                    </span>
                    {asset.collectionSize > 0 ? (
                      <span className="faucetAssetMeta">{asset.collectionSize} items</span>
                    ) : null}
                  </div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                  <small>{asset.description || 'Live faucet asset'}</small>
                </button>
              ))}
            </div>

            <div className="faucetAssetDetailCard">
              <div className="faucetAssetDetailBody">
                <div className="faucetAssetDetailHeader">
                  <div>
                    <span className={`faucetAssetType faucetAssetType-${selectedAsset.type}`}>
                      {getAssetTypeLabel(selectedAsset)}
                    </span>
                    <h3>
                      {selectedAsset.name} <span>{selectedAsset.symbol}</span>
                    </h3>
                  </div>
                  <div className="faucetAssetDetailMeta">
                    <span>Cooldown {formatCooldownLabel(selectedAsset.cooldownHours)}</span>
                    <span>
                      {selectedAsset.type === 'nft'
                        ? `${selectedAsset.collectionSize || 0} demo items`
                        : selectedAsset.claimMode === 'transfer'
                          ? 'On-chain transfer'
                          : selectedAsset.claimMode}
                    </span>
                  </div>
                </div>

                <p>{selectedAsset.description || 'Live faucet asset available on Kamet.'}</p>

                <div className="faucetMetaList">
                  <div className="faucetMetaRow">
                    <span className="faucetMetaLabel">Standard</span>
                    <strong className="faucetMetaValue">
                      {selectedAsset.type === 'nft' || selectedAsset.standard === 'erc721' || selectedAsset.standard === 'lep100-6'
                        ? 'lep100-6'
                        : selectedAsset.standard === 'erc20' || selectedAsset.type === 'lep100' || selectedAsset.type === 'LEP100'
                          ? 'lep100'
                          : (selectedAsset.standard || selectedAsset.type)}
                    </strong>
                  </div>
                  <div className="faucetMetaRow">
                    <span className="faucetMetaLabel">Claim mode</span>
                    <strong className="faucetMetaValue">{selectedAsset.claimMode}</strong>
                  </div>
                  <div className="faucetMetaRow">
                    <span className="faucetMetaLabel">Contract</span>
                    <strong className="faucetMetaValue">
                      {selectedAsset.contractAddress
                        ? shortenMiddle(selectedAsset.contractAddress, 6, 4)
                        : selectedAsset.claimMode === 'source-only'
                          ? 'LithoVM / Lithic'
                          : 'Native asset'}
                    </strong>
                  </div>
                  {selectedAsset.type === 'nft' && selectedAsset.contractAddress && (
                    <div className="faucetMetaRow">
                      <span className="faucetMetaLabel">Litho1 address</span>
                      <strong className="faucetMetaValue faucetMetaValue--mono">
                        {toBech32Address(selectedAsset.contractAddress)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {selectedAsset.previewImage ? (
                <div className="faucetAssetPreview">
                  <img
                    src={selectedAsset.previewImage}
                    alt={`${selectedAsset.name} preview`}
                    loading="lazy"
                  />
                </div>
              ) : null}
            </div>

            {selectedAsset.claimMode === 'source-only' ? (
              <div className="faucetInlineNotice">
                This is a source-only Lithic ({selectedAsset.standard}) contract running on LithoVM. It is not transferable via the EVM faucet.
              </div>
            ) : (
              <>
                <div className="fieldLabelRow">
                  <div className="fieldLabel">
                    {selectedAsset.type === 'nft' ? 'Minted Item' : 'Amount'}
                  </div>
                  <span className="fieldHint">
                    {selectedAsset.type === 'nft'
                      ? 'One NFT mint per claim when collection inventory is available'
                      : `Allowed: ${selectedAsset.type === 'native' ? `${LITHO_SYMBOL} ` : ''}${selectedAsset.amountOptions.join(', ')} ${selectedAsset.symbol}`}
                  </span>
                </div>

                <div className="amountSelector">
                  {selectedAsset.amountOptions.map((amount) => (
                    <button
                      key={`${selectedAsset.id}-${amount}`}
                      type="button"
                      className={`amountOption ${selectedAmount === amount ? 'active' : ''}`}
                      onClick={() => setSelectedAmount(amount)}
                    >
                      {selectedAsset.type === 'nft' ? '1 Mint' : `${selectedAsset.type === 'native' ? `${LITHO_SYMBOL} ` : ''}${amount} ${selectedAsset.symbol}`}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="submit"
              className="primary-btn faucetSubmit"
              disabled={
                submitting ||
                !addressType ||
                faucetAvailability.loading ||
                !faucetAvailability.ready ||
                !selectedAsset ||
                selectedAsset.claimMode === 'source-only'
              }
            >
              {faucetAvailability.loading
                ? 'Checking Claim Service...'
                : !faucetAvailability.ready
                  ? 'Claims Temporarily Unavailable'
                  : submitting
                    ? selectedAsset.type === 'nft'
                      ? 'Minting NFT...'
                      : 'Requesting Assets...'
                    : getAssetActionLabel(selectedAsset, selectedAmount)}
            </button>
          </form>

          {claimResult && (
            <div className={`explorerMessage ${claimResult.type}`}>
              <span>{claimResult.message}</span>
              {claimResult.tokenId ? <span>Minted token #{claimResult.tokenId}</span> : null}
              {claimResult.txHash && (
                <Link to={`/tx/${claimResult.txHash}`} className="messageLink">
                  View transaction
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="explorerPanel">
          <div className="faucetPanelHeader">
            <div>
              <div className="explorerSectionTitle">Network Setup</div>
              <p className="panelLead">
                Live Kamet values for wallet setup, explorer navigation, and RPC/LCD access.
              </p>
            </div>
          </div>

          <div className="detailList faucetDetailList">
            {networkSummary.map(({ id, label, value, helper }) => (
              <div key={id} className="detailRow multiLine faucetDetailRow">
                <div className="faucetDetailLabel">
                  <span>{label}</span>
                  <small>{helper}</small>
                </div>
                <div className="faucetDetailValue">
                  <code>{value}</code>
                  <button type="button" className="faucetCopyButton" onClick={() => handleCopyValue(id, value)}>
                    {copiedField === id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="faucetGuide">
            <div className="explorerSectionTitle compact">Address formats</div>
            <p>
              Use <code>0x...</code> in browser wallets. Use{' '}
              <code>litho1...</code> in Cosmos-native tools such as Keplr.
            </p>
            <p>
              If a browser wallet says a <code>litho1...</code> address is invalid, that is expected.
              The bech32 address belongs to the Cosmos layer, not the Lithosphere send form.
            </p>
            <div className="faucetGuideLinks">
              <Link to="/blocks" className="messageLink">
                View blocks
              </Link>
              <Link to="/validators" className="messageLink">
                View validators
              </Link>
              <Link to="/txs" className="messageLink">
                View transactions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
