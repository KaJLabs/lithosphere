import bridgeIcon from '../assets/icons/sidebar/bridge.svg';
import governance from '../assets/icons/sidebar/governance.svg';
import dex from '../assets/icons/sidebar/dex.svg';
import names from '../assets/icons/sidebar/names.svg';
import tokenExplorer from '../assets/icons/sidebar/tokenExplorer.svg';
import additionalInfo from '../assets/icons/sidebar/additionalInfo.svg';
import settings from '../assets/icons/sidebar/settings.svg';

export const menuSections = [
  {
    title: 'Explore',
    items: [
      {
        key: '/',
        label: 'Home',
        icon: tokenExplorer,
        matchers: ['/']
      },
      {
        key: '/blocks',
        label: 'Blocks',
        icon: tokenExplorer,
        matchers: ['/blocks', '/block/:heightOrHash', '/blocks/:heightOrHash']
      },
      {
        key: '/transactions',
        label: 'Transactions',
        icon: tokenExplorer,
        matchers: ['/transactions', '/txs', '/tx/:hash', '/txs/:hash']
      },
      {
        key: '/addresses',
        label: 'Addresses',
        icon: tokenExplorer,
        matchers: ['/addresses', '/address/:address', '/address-search']
      },
      {
        key: '/tokens',
        label: 'Tokens',
        icon: tokenExplorer,
        matchers: ['/tokens', '/token/:contract']
      },
      {
        key: '/validators',
        label: 'Validators',
        icon: tokenExplorer,
        matchers: ['/validators', '/validator/:operator']
      },
      {
        key: '/contracts',
        label: 'Contracts',
        icon: tokenExplorer,
        matchers: ['/contracts', '/contract/:address']
      },
      {
        key: '/network',
        label: 'Network',
        icon: additionalInfo,
        matchers: ['/network', '/Network_Information']
      }
    ]
  },
  {
    title: 'Utilities',
    items: [
      {
        key: '/search',
        label: 'Search',
        icon: tokenExplorer,
        matchers: ['/search']
      },
      {
        key: '/faucet',
        label: 'Faucet',
        icon: settings,
        matchers: ['/faucet', '/settings']
      },
      {
        key: '/bridge',
        label: 'Bridge',
        icon: bridgeIcon,
        matchers: ['/bridge', '/bridge/release', '/swap', '/Swap']
      },
      {
        key: '/governance',
        label: 'Governance',
        icon: governance,
        matchers: ['/governance', '/governance/:id']
      },
      {
        key: '/dex',
        label: 'DEX',
        icon: dex,
        matchers: [
          '/dex',
          '/dex/swap',
          '/dex/pool',
          '/dex/pool/:address',
          '/dex/positions',
          '/dex/positions/new'
        ]
      },
      {
        key: '/names',
        label: 'Names',
        icon: names,
        matchers: ['/names', '/names/:name']
      }
    ]
  }
];
