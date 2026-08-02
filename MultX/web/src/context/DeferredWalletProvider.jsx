import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAIN_CONFIG, EvmAPI } from '../config/api';
import { WalletContext, defaultWalletContextValue } from './walletContextBase';

const MANUAL_DISCONNECT_KEY = 'kamet-wallet-manual-disconnect';

const createDisconnectedState = () => ({
  account: '',
  chainId: null,
  isConnected: false,
  provider: null,
  signer: null
});

const getInjectedProvider = () =>
  typeof window !== 'undefined' && window.ethereum ? window.ethereum : null;

const hasMetaMask = () => Boolean(getInjectedProvider());

const parseChainId = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  const radix = normalized.startsWith('0x') ? 16 : 10;
  const parsed = Number.parseInt(normalized, radix);

  return Number.isFinite(parsed) ? parsed : null;
};

const readManualDisconnectState = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.sessionStorage.getItem(MANUAL_DISCONNECT_KEY) === '1';
  } catch {
    return false;
  }
};

const writeManualDisconnectState = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value) {
      window.sessionStorage.setItem(MANUAL_DISCONNECT_KEY, '1');
      return;
    }

    window.sessionStorage.removeItem(MANUAL_DISCONNECT_KEY);
  } catch {
    // Ignore storage failures so wallet flows continue in locked-down browsers.
  }
};

const ensureEthers = async () => {
  const module = await import('ethers5');
  return module.ethers;
};

const requestWalletAccessIfNeeded = async (injectedProvider) => {
  if (!injectedProvider?.request) {
    return;
  }

  const accountsResponse = await injectedProvider
    .request({ method: 'eth_accounts' })
    .catch(() => []);
  const accounts = Array.isArray(accountsResponse) ? accountsResponse.filter(Boolean) : [];

  if (!accounts.length) {
    await injectedProvider.request({ method: 'eth_requestAccounts' });
  }
};

export const DeferredWalletProvider = ({ children }) => {
  const [walletState, setWalletState] = useState(createDisconnectedState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const manualDisconnectRef = useRef(readManualDisconnectState());

  const clearWalletState = useCallback((nextError = null) => {
    setWalletState(createDisconnectedState());
    setError(nextError);
  }, []);

  const hydrateInjectedWallet = useCallback(
    async ({ requestAccounts = false, respectManualDisconnect = true } = {}) => {
      const injectedProvider = getInjectedProvider();

      if (!injectedProvider?.request) {
        if (requestAccounts) {
          throw new Error(
            `Install an injected browser wallet to connect to ${CHAIN_CONFIG.chainName}.`
          );
        }

        clearWalletState();
        return createDisconnectedState();
      }

      if (respectManualDisconnect && manualDisconnectRef.current) {
        clearWalletState();
        return createDisconnectedState();
      }

      const accountsResponse = await injectedProvider.request({
        method: requestAccounts ? 'eth_requestAccounts' : 'eth_accounts'
      });
      const accounts = Array.isArray(accountsResponse) ? accountsResponse.filter(Boolean) : [];
      const account = accounts[0] || '';

      if (!account) {
        clearWalletState();
        return createDisconnectedState();
      }

      const chainIdResponse = await injectedProvider
        .request({ method: 'eth_chainId' })
        .catch(() => injectedProvider.chainId);
      const chainId = parseChainId(chainIdResponse);
      const ethers = await ensureEthers();
      const provider = new ethers.providers.Web3Provider(injectedProvider);
      let signer = null;

      try {
        signer = provider.getSigner();
      } catch {
        signer = null;
      }

      const nextState = {
        account,
        chainId,
        isConnected: true,
        provider,
        signer
      };

      manualDisconnectRef.current = false;
      writeManualDisconnectState(false);
      setWalletState(nextState);
      setError(null);

      return nextState;
    },
    [clearWalletState]
  );

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      return await hydrateInjectedWallet({
        requestAccounts: true,
        respectManualDisconnect: false
      });
    } catch (connectError) {
      const nextError =
        connectError?.message || `Unable to connect an injected wallet right now.`;
      setError(nextError);
      throw connectError;
    } finally {
      setLoading(false);
    }
  }, [hydrateInjectedWallet]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    writeManualDisconnectState(true);
    clearWalletState();
  }, [clearWalletState]);

  const prefetch = useCallback(async () => null, []);

  const switchToLithoChain = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const injectedProvider = getInjectedProvider();

      if (!injectedProvider?.request) {
        throw new Error(`Install an injected browser wallet to add ${CHAIN_CONFIG.chainName}.`);
      }

      await requestWalletAccessIfNeeded(injectedProvider);

      try {
        await injectedProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CHAIN_CONFIG.evmChainIdHex }]
        });
      } catch (switchError) {
        const shouldAddChain =
          switchError?.code === 4902 ||
          /unknown chain|unrecognized chain|not found/i.test(switchError?.message || '');

        if (!shouldAddChain) {
          throw switchError;
        }

        await injectedProvider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_CONFIG.evmChainIdHex,
              chainName: CHAIN_CONFIG.chainName,
              nativeCurrency: {
                name: CHAIN_CONFIG.chainName,
                symbol: CHAIN_CONFIG.denom,
                decimals: CHAIN_CONFIG.decimals
              },
              rpcUrls: [EvmAPI.rpcUrl],
              blockExplorerUrls: [CHAIN_CONFIG.explorerUrl]
            }
          ]
        });
      }

      await hydrateInjectedWallet({
        requestAccounts: false,
        respectManualDisconnect: false
      });
    } catch (switchNetworkError) {
      const nextError =
        switchNetworkError?.message || `Unable to switch to ${CHAIN_CONFIG.chainName}.`;
      setError(nextError);
      throw switchNetworkError;
    } finally {
      setLoading(false);
    }
  }, [hydrateInjectedWallet]);

  useEffect(() => {
    const injectedProvider = getInjectedProvider();

    if (!injectedProvider?.on) {
      if (!manualDisconnectRef.current) {
        void hydrateInjectedWallet().catch(() => null);
      }

      return undefined;
    }

    const handleAccountsChanged = (accounts) => {
      const nextAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : [];

      if (!nextAccounts.length) {
        manualDisconnectRef.current = false;
        writeManualDisconnectState(false);
        clearWalletState();
        return;
      }

      manualDisconnectRef.current = false;
      writeManualDisconnectState(false);
      void hydrateInjectedWallet({ respectManualDisconnect: false }).catch(() => null);
    };

    const handleChainChanged = (nextChainId) => {
      setWalletState((currentState) =>
        currentState.isConnected
          ? {
              ...currentState,
              chainId: parseChainId(nextChainId)
            }
          : currentState
      );
    };

    const handleDisconnect = () => {
      clearWalletState();
    };

    injectedProvider.on('accountsChanged', handleAccountsChanged);
    injectedProvider.on('chainChanged', handleChainChanged);
    injectedProvider.on('disconnect', handleDisconnect);

    if (!manualDisconnectRef.current) {
      void hydrateInjectedWallet({ respectManualDisconnect: false }).catch(() => null);
    }

    return () => {
      injectedProvider.removeListener?.('accountsChanged', handleAccountsChanged);
      injectedProvider.removeListener?.('chainChanged', handleChainChanged);
      injectedProvider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [clearWalletState, hydrateInjectedWallet]);

  const contextValue = useMemo(
    () => ({
      ...defaultWalletContextValue,
      ...walletState,
      ready: true,
      loading,
      error,
      connect,
      disconnect,
      prefetch,
      switchToLithoChain,
      hasMetaMask
    }),
    [connect, disconnect, error, loading, prefetch, switchToLithoChain, walletState]
  );

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
};

export default DeferredWalletProvider;
