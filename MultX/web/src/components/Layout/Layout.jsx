import { useCallback, useContext, useEffect, useState } from 'react';
import '../../App.scss';
import { ThemeContext } from '../../context';
import Sidebar from '../Sidebar';
import Header from '../Header';
import { CHAIN_CONFIG } from '../../config/api';
import { fetchNetworkOverview } from '../../services/explorerDataService';

export const Layout = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const [statusSummary, setStatusSummary] = useState(null);

  const handleSkipToContent = useCallback((event) => {
    const content = document.getElementById('main-content');

    if (!content) {
      return;
    }

    event.preventDefault();
    content.focus();
    content.scrollIntoView({ block: 'start' });
  }, []);

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      const overview = await fetchNetworkOverview().catch(() => null);

      if (active) {
        setStatusSummary(overview);
      }
    };

    loadStatus();
    const timer = window.setInterval(loadStatus, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className={`app ${theme ? 'theme-light' : 'theme-dark'}`}>
      <a href="#main-content" className="skipLink" onClick={handleSkipToContent}>
        Skip to main content
      </a>
      <Sidebar />
      <div className="app-body">
        <Header statusSummary={statusSummary} />
        <main id="main-content" className="content" tabIndex={-1}>
          {children}
        </main>
        <footer className="explorerFooter">
          <div className="explorerFooter-brand">
            <strong>Kamet Explorer</strong>
            <span>{CHAIN_CONFIG.chainName}</span>
          </div>
          <div className="explorerFooter-links">
            <a href={CHAIN_CONFIG.footerLinks.docs} target="_blank" rel="noreferrer">
              Docs
            </a>
            <a href={CHAIN_CONFIG.footerLinks.status} target="_blank" rel="noreferrer">
              Status
            </a>
            <a href={CHAIN_CONFIG.footerLinks.rpc} target="_blank" rel="noreferrer">
              RPC
            </a>
            <a href={CHAIN_CONFIG.footerLinks.faucet} target="_blank" rel="noreferrer">
              Faucet
            </a>
            <a href={CHAIN_CONFIG.footerLinks.validatorPortal} target="_blank" rel="noreferrer">
              Validator Portal
            </a>
          </div>
          <div className="explorerFooter-meta">
            <span>{statusSummary?.statusMessage || 'Status link available'}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
