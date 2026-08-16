/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers5';
import { createWeb3Modal, defaultConfig, useWeb3Modal } from '@web3modal/ethers/react';
import { EthersStoreUtil } from '@web3modal/scaffold-utils/ethers';
import { CHAIN_CONFIG, EvmAPI } from '../config/api';
import { WalletContext, defaultWalletContextValue } from './walletContextBase';

const PROJECT_ID =
  import.meta.env.VITE_WC_PROJECT_ID || '4d5085c5fd29c034f63f9256013dcd09';

const lithosphereChain = {
  chainId: CHAIN_CONFIG.evmChainId,
  name: CHAIN_CONFIG.chainName,
  currency: CHAIN_CONFIG.denom || 'LITHO',
  explorerUrl: CHAIN_CONFIG.explorerUrl,
  rpcUrl: EvmAPI.rpcUrl
};

const metadata = {
  name: 'Kamet Explorer',
  description: 'Lithosphere Kamet Block Explorer',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://kamet.litho.ai',
  icons: ['https://lithosphere.network/wp-content/uploads/2026/02/icon-1-300x234.png']
};

const ethersConfig = defaultConfig({
  metadata,
  enableEIP6963: true,
  enableInjected: true,
  enableCoinbase: true,
  rpcUrl: EvmAPI.rpcUrl,
  defaultChainId: CHAIN_CONFIG.evmChainId,
  auth: { email: false, socials: [] }
});

let web3ModalReady = false;
if (typeof window !== 'undefined') {
  try {
    createWeb3Modal({
      ethersConfig,
      chains: [lithosphereChain],
      projectId: PROJECT_ID,
      featuredWalletIds: [
        'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
        '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
        '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369'
      ],
      enableAnalytics: false,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#4d7dff'
      }
    });
    web3ModalReady = true;
  } catch (err) {
    console.error('[Web3Modal] init failed', err);
  }
}

export const isWeb3ModalReady = () => web3ModalReady;

// Read EthersStoreUtil.state directly + subscribe via the vanilla Valtio API.
// useWeb3ModalAccount/useWeb3ModalProvider hooks call useSnapshot, which hits
// a known proxy-compare minifier bug ("an is not iterable"). Direct property
// reads + subscribe sidestep snapshot entirely.
const readStoreState = () => {
  const s = EthersStoreUtil.state;
  return {
    address: s.address || '',
    chainId: typeof s.chainId === 'number' ? s.chainId : null,
    isConnected: Boolean(s.isConnected),
    walletProvider: s.provider || null
  };
};

const Web3ModalWalletAdapter = ({ children }) => {
  const { open } = useWeb3Modal();
  const [{ address, chainId, isConnected, walletProvider }, setStoreState] = useState(readStoreState);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sync = () => setStoreState(readStoreState());
    sync();
    const unsub = EthersStoreUtil.subscribe(sync);
    return unsub;
  }, []);

  const provider = useMemo(() => {
    if (!walletProvider) return null;
    try {
      return new ethers.providers.Web3Provider(walletProvider);
    } catch {
      return null;
    }
  }, [walletProvider]);

  const signer = useMemo(() => {
    if (!provider) return null;
    try {
      return provider.getSigner();
    } catch {
      return null;
    }
  }, [provider]);

  const switchToLithoChain = useCallback(async () => {
    if (!walletProvider?.request) return;
    try {
      await walletProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_CONFIG.evmChainIdHex }]
      });
    } catch (switchError) {
      const shouldAdd =
        switchError?.code === 4902 ||
        /unknown chain|unrecognized chain|not found/i.test(switchError?.message || '');
      if (!shouldAdd) throw switchError;
      await walletProvider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: CHAIN_CONFIG.evmChainIdHex,
            chainName: CHAIN_CONFIG.chainName,
            nativeCurrency: {
              name: CHAIN_CONFIG.denom || 'LITHO',
              symbol: CHAIN_CONFIG.denom || 'LITHO',
              decimals: CHAIN_CONFIG.decimals || 18
            },
            rpcUrls: [EvmAPI.rpcUrl],
            blockExplorerUrls: [CHAIN_CONFIG.explorerUrl]
          }
        ]
      });
    }
  }, [walletProvider]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await open();
      return null;
    } catch (err) {
      setError(err?.message || 'Failed to open wallet picker');
      throw err;
    }
  }, [open]);

  const disconnect = useCallback(() => {
    if (walletProvider?.disconnect) {
      try {
        walletProvider.disconnect();
      } catch {
        /* ignore */
      }
    }
    EthersStoreUtil.reset();
  }, [walletProvider]);

  const value = useMemo(
    () => ({
      ...defaultWalletContextValue,
      ready: true,
      loading: false,
      account: address,
      chainId,
      isConnected,
      provider,
      signer,
      error,
      connect,
      disconnect,
      prefetch: async () => null,
      switchToLithoChain,
      hasMetaMask: () => typeof window !== 'undefined' && Boolean(window.ethereum)
    }),
    [address, chainId, isConnected, provider, signer, error, connect, disconnect, switchToLithoChain]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const Web3ModalWalletProvider = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <WalletContext.Provider value={defaultWalletContextValue}>
        {children}
      </WalletContext.Provider>
    );
  }

  return <Web3ModalWalletAdapter>{children}</Web3ModalWalletAdapter>;
};

export default Web3ModalWalletProvider;
