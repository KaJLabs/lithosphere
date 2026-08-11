import { useContext, useMemo, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import lithoLogo from '../assets/icons/litho-mark.png';
import { CHAIN_CONFIG } from '../config/api';
import { useWallet } from '../hooks/useWallet';
import { SidebarContext } from '../context';
import { GlobalSearchForm } from './explorer/GlobalSearchForm';
import { StatusBadge } from './explorer/ExplorerUI';
import WalletConnectDialog from './WalletConnectDialog';
import '../scss/components/header.scss';

const BentoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="7.5" y="1" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="14" y="1" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="1" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="7.5" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="14" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="1" y="14" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="7.5" y="14" width="5" height="5" rx="1.5" fill="currentColor" />
    <rect x="14" y="14" width="5" height="5" rx="1.5" fill="currentColor" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const routeTitles = [
  { label: 'Home', matchers: ['/'] },
  { label: 'Blocks', matchers: ['/blocks', '/block/:heightOrHash', '/blocks/:heightOrHash'] },
  { label: 'Transactions', matchers: ['/transactions', '/txs', '/tx/:hash', '/txs/:hash'] },
  { label: 'Addresses', matchers: ['/addresses', '/address/:address', '/address-search'] },
  { label: 'Tokens', matchers: ['/tokens', '/token/:contract'] },
  { label: 'Validators', matchers: ['/validators', '/validator/:operator'] },
  { label: 'Contracts', matchers: ['/contracts', '/contract/:address'] },
  { label: 'Search', matchers: ['/search'] },
  { label: 'Network', matchers: ['/network', '/Network_Information'] },
  { label: 'Faucet', matchers: ['/faucet', '/settings'] },
  { label: 'Swap', matchers: ['/swap', '/Swap'] }
];

const resolveRouteLabel = (pathname) => {
  const entry = routeTitles.find(({ matchers }) =>
    matchers.some((pattern) =>
      matchPath(
        {
          path: pattern,
          end: true,
          caseSensitive: false
        },
        pathname
      )
    )
  );

  return entry?.label || 'Explorer';
};

const resolveStatusTone = (statusSummary) => {
  if (!statusSummary?.chainHealth || statusSummary.chainHealth === 'unknown') {
    return 'neutral';
  }

  return statusSummary.chainHealth === 'operational' ? 'success' : 'failed';
};

const resolveStatusLabel = (statusSummary) => {
  if (!statusSummary?.statusMessage) {
    return 'Status unavailable';
  }

  return statusSummary.chainHealth === 'operational' ? 'Operational' : statusSummary.statusMessage;
};

const Header = ({ statusSummary }) => {
  const location = useLocation();
  const wallet = useWallet();
  const { sidebarActive, setSidebarActive } = useContext(SidebarContext);
  const routeLabel = useMemo(() => resolveRouteLabel(location.pathname), [location.pathname]);
  const [dialog, setDialog] = useState({ open: false, mode: 'message', message: '' });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));
  const prefetchWallet = () => {
    void wallet.prefetch?.();
  };

  const walletLabel = wallet.loading
    ? 'Loading Wallet...'
    : wallet.isConnected
      ? 'Disconnect Wallet'
      : 'Connect Wallet';

  const handleWalletAction = async () => {
    if (wallet.loading) {
      return;
    }

    if (wallet.isConnected) {
      wallet.disconnect();
      return;
    }

    try {
      // Web3Modal opens its own wallet picker (WalletConnect QR + MetaMask + Trust + ...);
      // it deep-links into wallet apps on mobile, so we don't need a custom no-wallet branch.
      await wallet.connect();
    } catch (err) {
      // 4001 = user rejected the request in their wallet — no dialog needed.
      if (err?.code === 4001) return;
      console.error('[Header] Connect failed', err);
      setDialog({
        open: true,
        mode: 'message',
        message: err?.message || 'Failed to open wallet picker.'
      });
    }
  };

  return (
    <header className="explorerHeader">
      <div className="explorerHeader-top">
        <div className="explorerHeader-titleGroup">
          <button
            type="button"
            className={`menuToggle${sidebarActive ? ' is-open' : ''}`}
            onClick={() => setSidebarActive(!sidebarActive)}
            aria-label={sidebarActive ? 'Close menu' : 'Open menu'}
          >
            {sidebarActive ? <CloseIcon /> : <BentoIcon />}
          </button>
          <Link to="/" className="explorerHeader-brand">
            <img src={lithoLogo} alt="Lithosphere" />
            <div>
              <span className="explorerHeader-eyebrow">{CHAIN_CONFIG.networkLabel}</span>
              <strong>{routeLabel}</strong>
            </div>
          </Link>
        </div>

        <div className="explorerHeader-actions">
          <Link to="/network" className="statusLink">
            <StatusBadge tone={resolveStatusTone(statusSummary)}>{resolveStatusLabel(statusSummary)}</StatusBadge>
          </Link>
          <div className="walletButtonWrap">
            <button
              type="button"
              className={`secondary-btn headerWalletButton ${wallet.isConnected ? 'connected' : ''}`}
              onClick={() => void handleWalletAction()}
              onMouseEnter={prefetchWallet}
              onFocus={prefetchWallet}
              disabled={wallet.loading}
              title={wallet.account || walletLabel}
            >
              {walletLabel}
            </button>
          </div>
        </div>
      </div>

      <GlobalSearchForm className="headerSearch" />
      <WalletConnectDialog
        open={dialog.open}
        mode={dialog.mode}
        message={dialog.message}
        onClose={closeDialog}
      />
    </header>
  );
};

export default Header;
