import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createWeb3Modal,
  defaultConfig,
  useWeb3Modal,
  useWeb3ModalAccount,
  useDisconnect,
} from '@web3modal/ethers/react';

const PROJECT_ID = '4d5085c5fd29c034f63f9256013dcd09';

const MAKALU_CHAIN = {
  chainId: 700777,
  name: 'Lithosphere Makalu',
  currency: 'LITHO',
  explorerUrl: 'https://makalu.litho.ai',
  rpcUrl: 'https://rpc.litho.ai',
};

const metadata = {
  name: 'Lithosphere Explorer',
  description: 'Lithosphere Makalu Block Explorer',
  url: 'https://makalu.litho.ai',
  icons: ['https://makalu.litho.ai/favicon.ico'],
};

const ethersConfig = defaultConfig({
  metadata,
  defaultChainId: MAKALU_CHAIN.chainId,
  rpcUrl: MAKALU_CHAIN.rpcUrl,
  chains: [MAKALU_CHAIN],
});

// Initialize Web3Modal once (try/catch handles HMR re-initialization)
try {
  createWeb3Modal({
    ethersConfig,
    chains: [MAKALU_CHAIN],
    projectId: PROJECT_ID,
    enableAnalytics: true,
  });
} catch (error) {
  console.log('Web3Modal init:', error instanceof Error ? error.message : 'already initialized');
}

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  open: (options?: { view: 'Connect' | 'Account' | 'Networks' }) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  const value: WalletContextType = {
    address: address || null,
    isConnected: isConnected || false,
    chainId: chainId || null,
    open,
    disconnect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
