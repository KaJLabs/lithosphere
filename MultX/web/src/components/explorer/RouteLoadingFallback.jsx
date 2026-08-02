import {
  LoadingSkeleton,
  PageHero,
  Panel
} from './ExplorerUI';
import '../../scss/pages/Explorer/explorerPage.scss';

export const RouteLoadingFallback = () => (
  <div className="explorerPage">
    <PageHero
      eyebrow="Loading"
      title="Loading Explorer Page"
      description="Preparing the requested Kamet explorer surface."
    />

    <Panel title="Loading content">
      <LoadingSkeleton rows={6} />
    </Panel>
  </div>
);

export default RouteLoadingFallback;
