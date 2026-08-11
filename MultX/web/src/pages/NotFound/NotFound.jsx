import { Link, useLocation } from 'react-router-dom';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import GlobalSearchForm from '../../components/explorer/GlobalSearchForm';
import { EmptyState, PageHero, Panel } from '../../components/explorer/ExplorerUI';
import '../../scss/pages/Explorer/explorerPage.scss';

const NotFound = () => {
  const location = useLocation();

  usePageMeta('Not Found', defaultExplorerDescription);

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="404"
        title="Page Not Found"
        description="The requested explorer route does not exist or the deep link is malformed."
        actions={
          <Link className="primary-btn" to="/">
            Return Home
          </Link>
        }
      />

      <Panel title="Search Instead" description="Global search routes directly to blocks, transactions, addresses, tokens, validators, and contracts.">
        <GlobalSearchForm autoFocus placeholder="Search tx hash, block, address, token, validator, or contract" />
      </Panel>

      <EmptyState
        title={`No route for ${location.pathname}`}
        description="Check the URL and retry. Canonical deep links include /block/:height-or-hash, /tx/:hash, /address/:address, /token/:contract, and /validator/:operator."
        action={
          <Link className="link-btn" to="/network">
            Open Network Status
          </Link>
        }
      />
    </div>
  );
};

export { NotFound };
export default NotFound;
