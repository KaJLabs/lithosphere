import { useContext, useEffect } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import lithoLogo from '../assets/icons/litho-mark.png';
import { ThemeContext, SidebarContext } from '../context';
import { menuSections } from '../helpers/menus';
import { CHAIN_CONFIG } from '../config/api';
import '../scss/components/sidebar.scss';

const resourceLinks = [
  { label: 'Docs', href: CHAIN_CONFIG.footerLinks.docs },
  { label: 'Status', href: CHAIN_CONFIG.footerLinks.status },
  { label: 'RPC', href: CHAIN_CONFIG.footerLinks.rpc },
  { label: 'Faucet', href: CHAIN_CONFIG.footerLinks.faucet },
  { label: 'Validator Portal', href: CHAIN_CONFIG.footerLinks.validatorPortal }
];

const isRouteActive = (pathname, matchers = []) =>
  matchers.some((pattern) =>
    matchPath(
      {
        path: pattern,
        end: true,
        caseSensitive: false
      },
      pathname
    )
  );

const Sidebar = () => {
  const { theme, setTheme } = useContext(ThemeContext);
  const { sidebarActive, setSidebarActive } = useContext(SidebarContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSidebarActive(false);
  }, [pathname, setSidebarActive]);

  useEffect(() => {
    if (sidebarActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarActive]);

  return (
    <>
      <aside className={classNames('sidebar', { active: sidebarActive })}>
        <div className="sidebar-logo">
          <button type="button" className="logo" onClick={() => navigate('/')}>
            <span className="sidebar-logo-mark" aria-hidden="true">
              <img src={lithoLogo} alt="Lithosphere" style={{ height: 36, width: 'auto' }} />
            </span>
            <div className="sidebar-logo-copy">
              <div className="sidebar-logo-eyebrow">Lithosphere Explorer</div>
              <strong>Kamet Explorer</strong>
              <div className="sidebar-logo-meta">
                <span>{CHAIN_CONFIG.chainName}</span>
                <div className="sidebar-logo-network">Production v1</div>
              </div>
            </div>
          </button>
          <button type="button" className="close" onClick={() => setSidebarActive(false)} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {menuSections.map(({ title, items }) => (
          <div key={title} className="sidebar-userPanel">
            <p className="sidebar-userPanel-h">{title}</p>

            {items.map(({ key, label, icon, matchers }) => {
              const active = isRouteActive(pathname, matchers);

              return (
                <button
                  key={key}
                  type="button"
                  className={classNames('sidebar-userPanel-item', { active })}
                  onClick={() => navigate(key)}
                >
                  <div className="icon-wrap">
                    <img src={icon} alt="" aria-hidden="true" />
                  </div>
                  <div className="sidebar-userPanel-copy">
                    <span>{label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        <div className="sidebar-more">
          <p className="sidebar-userPanel-h">Resources</p>
          {resourceLinks.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className="sidebar-more-item">
              {label}
            </a>
          ))}
        </div>

        <div className="sidebar-theme">
          <div className="sidebar-theme-copy">
            <strong>Theme</strong>
            <span>{theme ? 'Light mode' : 'Dark mode'}</span>
          </div>
          <button
            type="button"
            className={`sidebar-theme-btn ${theme ? 'active' : ''}`}
            onClick={() => setTheme(!theme)}
            aria-label={theme ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-pressed={theme}
            title={theme ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <div className="point"></div>
          </button>
        </div>

        <div className="sidebar-copyright">
          Copyright (c) {new Date().getFullYear()} Lithosphere. All Rights Reserved.
        </div>
      </aside>
      {sidebarActive ? <button type="button" className="sidebarScrim" onClick={() => setSidebarActive(false)} aria-label="Close menu" /> : null}
    </>
  );
};

export default Sidebar;
