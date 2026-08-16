import { useContext } from 'react';
import { WalletContext } from '../context/walletContextBase';

/**
 * Custom hook for wallet connection and state management
 * @returns {Object} Wallet context with convenience methods
 */
export const useWallet = () => {
  return useContext(WalletContext);
};

export default useWallet;
