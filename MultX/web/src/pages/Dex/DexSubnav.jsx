import { NavLink } from 'react-router-dom';

const items = [
  { to: '/dex/swap',      label: 'Swap',         match: ['/dex', '/dex/swap'] },
  { to: '/dex/pool',      label: 'Pools',        match: ['/dex/pool'] },
  { to: '/dex/positions', label: 'My Positions', match: ['/dex/positions', '/dex/positions/new'] },
];

const isActiveFor = (pathname, match) =>
  match.some((m) => pathname === m || pathname.startsWith(m + '/'));

export const DexSubnav = ({ pathname = '' }) => (
  <nav className="dex-subnav" aria-label="DEX section">
    {items.map((item) => {
      const active = isActiveFor(pathname, item.match);
      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={`dex-subnav__link${active ? ' dex-subnav__link--active' : ''}`}
        >
          {item.label}
        </NavLink>
      );
    })}
  </nav>
);

export default DexSubnav;
