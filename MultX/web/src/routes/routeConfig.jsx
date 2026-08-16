import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import RouteLoadingFallback from '../components/explorer/RouteLoadingFallback';

const SearchEngine = lazy(() => import('../pages/SearchEngine/SearchEngine'));
const AddressSearch = lazy(() => import('../pages/AddressSearch/AddressSearch'));
const AddressPage = lazy(() => import('../pages/AddressDetails/AddressPage'));
const BlockExplorer = lazy(() => import('../pages/BlockExplorer/BlockExplorer'));
const BlockDetail = lazy(() => import('../pages/BlockExplorer/BlockDetail'));
const TransactionSearch = lazy(() => import('../pages/TransactionSearch/TransactionSearch'));
const TransactionDetail = lazy(() => import('../pages/TransactionSearch/TransactionDetail'));
const Tokens = lazy(() => import('../pages/Tokens/Tokens'));
const TokenDetail = lazy(() => import('../pages/Tokens/TokenDetail'));
const ValidatorList = lazy(() => import('../pages/ValidatorList/ValidatorList'));
const ValidatorDetail = lazy(() => import('../pages/ValidatorList/ValidatorDetail'));
const Contracts = lazy(() => import('../pages/Contracts/Contracts'));
const ContractDetail = lazy(() => import('../pages/Contracts/ContractDetail'));
const SearchResults = lazy(() => import('../pages/SearchResults/SearchResults'));
const AdditionalInfo = lazy(() =>
  import('../pages/AdditionalInfo/AdditionalInfo').then((module) => ({
    default: module.AdditionalInfo
  }))
);
const NotFound = lazy(() => import('../pages/NotFound/NotFound'));
const Settings = lazy(() =>
  import('../pages/Settings/Settings').then((module) => ({
    default: module.Settings
  }))
);
const Swap = lazy(() =>
  import('../pages/Swap/Swap').then((module) => ({
    default: module.Swap
  }))
);
const Governance = lazy(() =>
  import('../pages/Governance/Governance').then((module) => ({
    default: module.Governance
  }))
);
const ProposalDetail = lazy(() =>
  import('../pages/Governance/ProposalDetail').then((module) => ({
    default: module.ProposalDetail
  }))
);
const DexSwap = lazy(() =>
  import('../pages/Dex/DexSwap').then((module) => ({
    default: module.DexSwap
  }))
);
const DexPoolList = lazy(() =>
  import('../pages/Dex/DexPoolList').then((module) => ({
    default: module.DexPoolList
  }))
);
const DexPoolDetail = lazy(() =>
  import('../pages/Dex/DexPoolDetail').then((module) => ({
    default: module.DexPoolDetail
  }))
);
const DexPositions = lazy(() =>
  import('../pages/Dex/DexPositions').then((module) => ({
    default: module.DexPositions
  }))
);
const DexPositionNew = lazy(() =>
  import('../pages/Dex/DexPositionNew').then((module) => ({
    default: module.DexPositionNew
  }))
);
const DexPositionDetail = lazy(() =>
  import('../pages/Dex/DexPositionDetail').then((module) => ({
    default: module.DexPositionDetail
  }))
);
const Names = lazy(() =>
  import('../pages/Names/Names').then((module) => ({
    default: module.Names
  }))
);
const NameDetail = lazy(() =>
  import('../pages/Names/NameDetail').then((module) => ({
    default: module.NameDetail
  }))
);
const CreateSubdomain = lazy(() =>
  import('../pages/Names/CreateSubdomain').then((module) => ({
    default: module.CreateSubdomain
  }))
);
const Bridge = lazy(() =>
  import('../pages/Bridge/Bridge').then((module) => ({
    default: module.Bridge
  }))
);
const BridgeRelease = lazy(() =>
  import('../pages/Bridge/BridgeRelease').then((module) => ({
    default: module.BridgeRelease
  }))
);
const BridgeInbound = lazy(() =>
  import('../pages/Bridge/BridgeInbound').then((module) => ({
    default: module.BridgeInbound
  }))
);

const RedirectWithParams = ({ buildPath }) => {
  const params = useParams();
  return <Navigate to={buildPath(params)} replace />;
};

const LazyRouteElement = ({ Component }) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Component />
  </Suspense>
);

export const DashBoardLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

export const DashBoardRoutes = () => (
  <>
    <Route element={<DashBoardLayout />}>
      <Route index element={<LazyRouteElement Component={SearchEngine} />} />
      <Route path="blocks" element={<LazyRouteElement Component={BlockExplorer} />} />
      <Route path="block/:heightOrHash" element={<LazyRouteElement Component={BlockDetail} />} />
      <Route path="transactions" element={<LazyRouteElement Component={TransactionSearch} />} />
      <Route path="tx/:hash" element={<LazyRouteElement Component={TransactionDetail} />} />
      <Route path="addresses" element={<LazyRouteElement Component={AddressSearch} />} />
      <Route path="address/:address" element={<LazyRouteElement Component={AddressPage} />} />
      <Route path="tokens" element={<LazyRouteElement Component={Tokens} />} />
      <Route path="token/:contract" element={<LazyRouteElement Component={TokenDetail} />} />
      <Route path="validators" element={<LazyRouteElement Component={ValidatorList} />} />
      <Route path="validator/:operator" element={<LazyRouteElement Component={ValidatorDetail} />} />
      <Route path="contracts" element={<LazyRouteElement Component={Contracts} />} />
      <Route path="contract/:address" element={<LazyRouteElement Component={ContractDetail} />} />
      <Route path="search" element={<LazyRouteElement Component={SearchResults} />} />
      <Route path="network" element={<LazyRouteElement Component={AdditionalInfo} />} />
      <Route path="faucet" element={<LazyRouteElement Component={Settings} />} />
      <Route path="settings" element={<LazyRouteElement Component={Settings} />} />
      <Route path="swap" element={<LazyRouteElement Component={Swap} />} />
      <Route path="governance" element={<LazyRouteElement Component={Governance} />} />
      <Route path="governance/:id" element={<LazyRouteElement Component={ProposalDetail} />} />
      <Route path="dex" element={<LazyRouteElement Component={DexSwap} />} />
      <Route path="dex/swap" element={<LazyRouteElement Component={DexSwap} />} />
      <Route path="dex/pool" element={<LazyRouteElement Component={DexPoolList} />} />
      <Route path="dex/pool/:address" element={<LazyRouteElement Component={DexPoolDetail} />} />
      <Route path="dex/positions" element={<LazyRouteElement Component={DexPositions} />} />
      <Route path="dex/positions/new" element={<LazyRouteElement Component={DexPositionNew} />} />
      <Route path="dex/positions/:tokenId" element={<LazyRouteElement Component={DexPositionDetail} />} />
      <Route path="names" element={<LazyRouteElement Component={Names} />} />
      <Route path="names/:name/subdomains/new" element={<LazyRouteElement Component={CreateSubdomain} />} />
      <Route path="names/:name" element={<LazyRouteElement Component={NameDetail} />} />
      <Route path="bridge" element={<LazyRouteElement Component={Bridge} />} />
      <Route path="bridge/inbound" element={<LazyRouteElement Component={BridgeInbound} />} />
      <Route path="bridge/release" element={<LazyRouteElement Component={BridgeRelease} />} />
      <Route path="*" element={<LazyRouteElement Component={NotFound} />} />
    </Route>

    <Route path="blocks/:heightOrHash" element={<RedirectWithParams buildPath={({ heightOrHash }) => `/block/${heightOrHash}`} />} />
    <Route path="txs" element={<Navigate to="/transactions" replace />} />
    <Route path="txs/:hash" element={<RedirectWithParams buildPath={({ hash }) => `/tx/${hash}`} />} />
    <Route path="address-search" element={<Navigate to="/addresses" replace />} />
    <Route path="AI_Search_Engine" element={<Navigate to="/" replace />} />
    <Route path="AI_Search_Engine/:id" element={<RedirectWithParams buildPath={({ id }) => `/address/${id}`} />} />
    <Route path="Token_Explorer" element={<Navigate to="/tokens" replace />} />
    <Route path="Watchlist" element={<Navigate to="/search" replace />} />
    <Route path="Network_Information" element={<Navigate to="/network" replace />} />
    <Route path="Swap" element={<Navigate to="/swap" replace />} />
  </>
);
