import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import {
  AccountsContext,
  NotificationContext,
  SelectedPageContext,
  SidebarContext,
  ThemeContext
} from './context';
import WalletProvider from './context/WalletProvider';
import { availableAccounts } from './db/availableAccounts';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.scss';

const normalizeLegacyHashRoute = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const hash = window.location.hash || '';

  if (!hash.startsWith('#/')) {
    return;
  }

  const nextPath = hash.slice(1);
  const search = window.location.search || '';
  window.history.replaceState(null, '', `${nextPath}${search}`);
};

normalizeLegacyHashRoute();

export function Main() {
  const [theme, setTheme] = useState(false);
  const [notification, setNotification] = useState('');
  const [sidebarActive, setSidebarActive] = useState(false);
  const [selectedPage, setSelectedPage] = useState('');
  const [accounts, setAccounts] = useState([...availableAccounts]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <NotificationContext.Provider value={{ notification, setNotification }}>
        <SidebarContext.Provider value={{ sidebarActive, setSidebarActive }}>
          <SelectedPageContext.Provider value={{ selectedPage, setSelectedPage }}>
            <AccountsContext.Provider value={{ accounts, setAccounts }}>
              <WalletProvider>
                <AppErrorBoundary>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </AppErrorBoundary>
              </WalletProvider>
            </AccountsContext.Provider>
          </SelectedPageContext.Provider>
        </SidebarContext.Provider>
      </NotificationContext.Provider>
    </ThemeContext.Provider>
  );
}

export default Main;
