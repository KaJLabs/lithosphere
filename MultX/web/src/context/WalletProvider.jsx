import { Component, Suspense, lazy } from 'react';
import DeferredWalletProvider from './DeferredWalletProvider';

const ENABLE_WEB3MODAL = import.meta.env.VITE_ENABLE_WEB3MODAL === 'true';
const Web3ModalWalletProvider = ENABLE_WEB3MODAL
  ? lazy(() => import('./Web3ModalWalletProvider'))
  : null;

class WalletProviderWithFallback extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error('[WalletProvider] Web3Modal render failed; falling back to injected wallet', error);
  }
  render() {
    if (this.state.failed) {
      return <DeferredWalletProvider>{this.props.children}</DeferredWalletProvider>;
    }
    return (
      <Suspense fallback={<DeferredWalletProvider>{this.props.children}</DeferredWalletProvider>}>
        <Web3ModalWalletProvider>{this.props.children}</Web3ModalWalletProvider>
      </Suspense>
    );
  }
}

export const WalletProvider = ({ children }) => {
  if (!ENABLE_WEB3MODAL || !Web3ModalWalletProvider) {
    return <DeferredWalletProvider>{children}</DeferredWalletProvider>;
  }
  return <WalletProviderWithFallback>{children}</WalletProviderWithFallback>;
};

export default WalletProvider;
