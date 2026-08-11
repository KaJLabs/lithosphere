import { useEffect } from 'react';
import '../scss/components/walletConnectDialog.scss';

/**
 * Inline Kamet-styled wallet helper dialog. Replaces the browser's native
 * alert/confirm so the page doesn't hand control to the OS chrome and so
 * mobile users get an explicit, tappable "Open in MetaMask" button (the
 * implicit window.location redirect was being missed on phones).
 */
const WalletConnectDialog = ({ open, mode, message, onClose }) => {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const title =
    mode === 'no-wallet'
      ? 'Wallet not detected'
      : mode === 'mobile'
        ? 'Connect on mobile'
        : 'Wallet connection';

  const description =
    mode === 'no-wallet'
      ? 'Install a browser wallet and reload to continue.'
      : mode === 'mobile'
        ? 'On a phone, tap the button below to open this page inside your wallet app where the wallet is connected.'
        : message || 'Something went wrong while connecting your wallet.';

  const buildMetaMaskDeepLink = () => {
    if (typeof window === 'undefined') return 'https://metamask.io';
    const path = window.location.pathname + window.location.search + window.location.hash;
    return `https://metamask.app.link/dapp/${window.location.host}${path}`;
  };

  const primary =
    mode === 'mobile'
      ? { label: 'Open in wallet app', href: buildMetaMaskDeepLink() }
      : mode === 'no-wallet'
        ? { label: 'Get a wallet', href: 'https://metamask.io/download/' }
        : null;

  return (
    <div className="walletDialogBackdrop" role="presentation" onClick={onClose}>
      <div
        className="walletDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walletDialogTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="walletDialog-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="walletDialog-icon" aria-hidden="true">
          <span />
        </div>
        <h2 id="walletDialogTitle" className="walletDialog-title">
          {title}
        </h2>
        <p className="walletDialog-description">{description}</p>
        <div className="walletDialog-actions">
          {primary ? (
            <a
              className="primary-btn walletDialog-primary"
              href={primary.href}
              target={mode === 'mobile' ? '_self' : '_blank'}
              rel="noopener noreferrer"
              onClick={onClose}
            >
              {primary.label}
            </a>
          ) : null}
          <button type="button" className="secondary-btn walletDialog-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletConnectDialog;
