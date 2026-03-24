import React, { createContext, useContext, useEffect, useState } from 'react';
import { createWeb3Modal, useWeb3Modal, useWeb3ModalAccount } from '@web3modal/ethers/react';

const PROJECT_ID = '4d5085c5fd29c034f63f9256013dcd09';

const MAKALU_CHAIN = {
  chainId: 700777,
  name: 'Lithosphere Makalu',
  currency: 'LITHO',
  explorerUrl: 'https://makalu.litho.ai',
  rpcUrl: 'https://rpc.litho.ai',
};

// Initialize Web3Modal
createWeb3Modal({
  ethersConfig: {
    defaultChain: MAKALU_CHAIN.chainId,
    chains: [
      {
        chainId: MAKALU_CHAIN.chainId,
        name: MAKALU_CHAIN.name,
        currency: MAKALU_CHAIN.currency,
        explorerUrl: MAKALU_CHAIN.explorerUrl,
        rpcUrl: MAKALU_CHAIN.rpcUrl,
      },
    ],
  },
  projectId: PROJECT_ID,
  chains: [
    {
      chainId: MAKALU_CHAIN.chainId,
      name: MAKALU_CHAIN.name,
      currency: MAKALU_CHAIN.currency,
      explorerUrl: MAKALU_CHAIN.explorerUrl,
      rpcUrl: MAKALU_CHAIN.rpcUrl,
    },
  ],
  enableAnalytics: true,
});

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
    disconnect: async () => {
      // Web3Modal doesn't expose disconnect directly; user must use the modal
    },
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
