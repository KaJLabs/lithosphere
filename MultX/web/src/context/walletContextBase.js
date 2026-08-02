import { createContext } from 'react';

const noop = () => {};
const noopAsync = async () => null;
const hasMetaMask = () => typeof window !== 'undefined' && window.ethereum !== undefined;

export const defaultWalletContextValue = Object.freeze({
  ready: false,
  loading: false,
  account: '',
  chainId: null,
  connect: noopAsync,
  prefetch: noopAsync,
  disconnect: noop,
  isConnected: false,
  provider: null,
  signer: null,
  error: null,
  switchToLithoChain: noopAsync,
  hasMetaMask
});

export const WalletContext = createContext(defaultWalletContextValue);
