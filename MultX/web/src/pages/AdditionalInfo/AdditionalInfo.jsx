import { useCallback, useEffect, useState } from 'react';
import { CHAIN_CONFIG, CosmosAPI, EvmAPI } from '../../config/api';
import { useWallet } from '../../hooks/useWallet';
import { usePageMeta, defaultExplorerDescription } from '../../hooks/usePageMeta';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { fetchExplorerSummary, fetchNetworkOverview } from '../../services/explorerDataService';
import {
  EmptyState,
  ExplorerErrorState,
  FreshnessPill,
  LoadingSkeleton,
  MetricCard,
  PageHero,
  Panel,
  SectionMessage,
  StatusBadge,
  TimestampValue
} from '../../components/explorer/ExplorerUI';
import { classifyExplorerError } from '../../helpers/explorerErrors';
import { formatDurationSeconds, formatNumber } from '../../helpers/explorer';
import '../../scss/pages/Explorer/explorerPage.scss';

const resolveHealthTone = (health = '') => {
  const value = String(health || '').trim().toLowerCase();

  if (['operational', 'resolved', 'success', 'healthy', 'synced', 'reachable', 'ok'].includes(value)) {
    return 'success';
  }

  if (['unknown', 'neutral'].includes(value)) {
    return 'neutral';
  }

  if (['degraded', 'warning', 'investigating', 'maintenance', 'lagging', 'syncing', 'catching_up'].includes(value)) {
    return 'info';
  }

  return 'failed';
};

const resolveStatusTone = (health) => resolveHealthTone(health);
const resolveSeverityTone = (severity = '', status = '') => {
  if (['scheduled', 'planned', 'maintenance'].includes(String(status || '').toLowerCase())) {
    return 'info';
  }

  if (['scheduled', 'planned', 'maintenance'].includes(String(severity || '').toLowerCase())) {
    return 'info';
  }

  if (String(status || '').toLowerCase() === 'resolved' || severity === 'resolved') {
    return 'success';
  }

  if (severity === 'critical' || severity === 'failed') {
    return 'failed';
  }

  if (severity === 'warning' || severity === 'degraded' || severity === 'info') {
    return 'info';
  }

  return 'neutral';
};

const formatDurationMs = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? formatDurationSeconds(Number(value) / 1000) : '--';

const normalizeStatusLabel = (value = '', fallback = '') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .trim();

const formatPercentLabel = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return '--';
  }

  const hasFraction = Math.abs(numeric - Math.trunc(numeric)) > 0.0001;

  return `${numeric.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0
  })}%`;
};

const LITHO_SYMBOL = '\uD835\uDD43';

const buildStatusTimeline = (item, kind) => {
  const primaryTimestamp =
    kind === 'maintenance' ? item.startedAt || item.timestamp || '' : item.startedAt || item.timestamp || '';
  const entries = [];

  if (primaryTimestamp) {
    entries.push({
      label:
        kind === 'incident'
          ? 'Started'
          : kind === 'maintenance'
            ? 'Scheduled Start'
            : 'Timestamp',
      value: primaryTimestamp
    });
  }

  if ((kind === 'incident' || kind === 'maintenance') && Number(item.durationMs) > 0) {
    entries.push({
      label: kind === 'maintenance' ? 'Planned Duration' : 'Duration',
      value: formatDurationMs(item.durationMs),
      type: 'duration'
    });
  }

  if (kind === 'maintenance' && item.endsAt && item.endsAt !== primaryTimestamp) {
    entries.push({
      label: 'Scheduled End',
      value: item.endsAt
    });
  }

  if (kind === 'incident' && item.lastEventAt && item.lastEventAt !== primaryTimestamp) {
    entries.push({
      label: 'Last Event',
      value: item.lastEventAt
    });
  }

  if (item.createdAt && item.createdAt !== primaryTimestamp) {
    entries.push({
      label: 'Created',
      value: item.createdAt
    });
  }

  if (item.updatedAt && item.updatedAt !== primaryTimestamp && item.updatedAt !== item.lastEventAt) {
    entries.push({
      label: 'Updated',
      value: item.updatedAt
    });
  }

  if (item.acknowledgedAt) {
    entries.push({
      label: 'Acknowledged',
      value: item.acknowledgedAt
    });
  }

  if (item.resolvedAt) {
    entries.push({
      label: 'Resolved',
      value: item.resolvedAt
    });
  }

  return entries;
};

const StatusActivityList = ({ items = [], emptyTitle, emptyDescription, kind = 'incident' }) => {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="eventList">
      {items.map((item, index) => {
        const fallbackTypeLabel = normalizeStatusLabel(item.type, kind);
        const title = item.title || fallbackTypeLabel;
        const timelineEntries = buildStatusTimeline(item, kind);
        const affectedTargets = Array.isArray(item.affectedTargets) ? item.affectedTargets.filter(Boolean) : [];
        const statusTone = resolveSeverityTone(item.severity, item.status);
        const message = item.message && item.message !== title ? item.message : '';
        const details = item.details && item.details !== title && item.details !== item.message ? item.details : '';
        const timeline = Array.isArray(item.timeline) ? item.timeline.filter(Boolean) : [];
        const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];

        return (
          <div
            key={`${item.incidentKey || item.type || kind}-${item.timestamp || item.startedAt || item.lastEventAt || index}`}
            className="eventCard"
          >
            <div className="eventHeader">
              <div className="validatorMiniHeader">
                <div className="eventTitleBlock">
                  <strong>{title}</strong>
                  <span>{fallbackTypeLabel}</span>
                </div>
                <StatusBadge tone={statusTone}>{item.status || item.severity || 'info'}</StatusBadge>
              </div>
              {item.component || item.source ? (
                <div className="eventMetaRow">
                  {item.component ? <span className="eventMetaPill">Component: {item.component}</span> : null}
                  {item.source ? <span className="eventMetaPill">Source: {item.source}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="eventBody">
              {message ? (
                <div className="eventAttribute">
                  <span>Message</span>
                  <p className="eventDetailText">{message}</p>
                </div>
              ) : null}
              {details ? (
                <div className="eventAttribute">
                  <span>Details</span>
                  <p className="eventDetailText">{details}</p>
                </div>
              ) : null}
              {item.impact ? (
                <div className="eventAttribute">
                  <span>Impact</span>
                  <p className="eventDetailText">{item.impact}</p>
                </div>
              ) : null}
              {item.rootCause ? (
                <div className="eventAttribute">
                  <span>Root Cause</span>
                  <p className="eventDetailText">{item.rootCause}</p>
                </div>
              ) : null}
              {item.resolution ? (
                <div className="eventAttribute">
                  <span>Resolution</span>
                  <p className="eventDetailText">{item.resolution}</p>
                </div>
              ) : null}
              {tags.length ? (
                <div className="eventAttribute">
                  <span>Tags</span>
                  <div className="eventTargetList">
                    {tags.map((tag) => (
                      <span key={`${title}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {item.node ? (
                <div className="eventAttribute">
                  <span>Endpoint</span>
                  <code>{item.node}</code>
                </div>
              ) : null}
              {affectedTargets.length ? (
                <div className="eventAttribute">
                  <span>Affected Targets</span>
                  <div className="eventTargetList">
                    {affectedTargets.map((target) => (
                      <span key={`${title}-${target}`}>{target}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {timelineEntries.map((entry) => (
                <div key={`${title}-${entry.label}`} className="eventAttribute">
                  <span>{entry.label}</span>
                  {entry.type === 'duration' ? <code>{entry.value}</code> : <TimestampValue value={entry.value} />}
                </div>
              ))}
              {item.externalUrl ? (
                <div className="eventAttribute">
                  <span>Incident Link</span>
                  <a className="inlineLink" href={item.externalUrl} target="_blank" rel="noreferrer">
                    Open public status detail
                  </a>
                </div>
              ) : null}
              {item.postmortemUrl ? (
                <div className="eventAttribute">
                  <span>Postmortem</span>
                  <a className="inlineLink" href={item.postmortemUrl} target="_blank" rel="noreferrer">
                    Open public postmortem
                  </a>
                </div>
              ) : null}
              {timeline.length ? (
                <div className="eventAttribute">
                  <span>Timeline Updates</span>
                  <div className="eventTimelineList">
                    {timeline.map((entry, entryIndex) => (
                      <div
                        key={`${title}-${entry.title || entry.type || entryIndex}`}
                        className="eventTimelineItem"
                      >
                        <div className="validatorMiniHeader">
                          <strong>{entry.title || 'Update'}</strong>
                          <StatusBadge tone={resolveSeverityTone(entry.severity, entry.status)}>
                            {entry.status || entry.severity || 'info'}
                          </StatusBadge>
                        </div>
                        {entry.message ? <p className="eventDetailText">{entry.message}</p> : null}
                        {entry.details ? <p className="eventDetailText">{entry.details}</p> : null}
                        <div className="eventMetaRow">
                          {entry.component ? (
                            <span className="eventMetaPill">Component: {entry.component}</span>
                          ) : null}
                          {entry.source ? (
                            <span className="eventMetaPill">Source: {entry.source}</span>
                          ) : null}
                          {entry.author ? (
                            <span className="eventMetaPill">Author: {entry.author}</span>
                          ) : null}
                        </div>
                        {entry.timestamp ? <TimestampValue value={entry.timestamp} /> : null}
                        {entry.externalUrl ? (
                          <a className="inlineLink" href={entry.externalUrl} target="_blank" rel="noreferrer">
                            Open update detail
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ComponentStatusList = ({ items = [], emptyTitle, emptyDescription }) => {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="componentStatusGrid">
      {items.map((item, index) => (
        <div key={item.key || `${item.title}-${index}`} className="componentStatusCard">
          <div className="componentStatusHeader">
            <div className="eventTitleBlock">
              <strong>{item.title}</strong>
              <span>{item.component || item.kind || 'Component'}</span>
            </div>
            <StatusBadge tone={resolveHealthTone(item.status)}>
              {item.statusLabel || item.status || 'unknown'}
            </StatusBadge>
          </div>
          {(item.kind || item.source) ? (
            <div className="eventMetaRow">
              {item.kind ? <span className="eventMetaPill">Kind: {item.kind}</span> : null}
              {item.source ? <span className="eventMetaPill">Source: {item.source}</span> : null}
            </div>
          ) : null}
          <div className="eventBody">
            {item.message ? (
              <div className="eventAttribute">
                <span>Message</span>
                <p className="eventDetailText">{item.message}</p>
              </div>
            ) : null}
            {item.details ? (
              <div className="eventAttribute">
                <span>Details</span>
                <p className="eventDetailText">{item.details}</p>
              </div>
            ) : null}
            {(item.latencyMs !== null && item.latencyMs !== undefined) || (item.uptimePercent !== null && item.uptimePercent !== undefined) ? (
              <div className="componentStatusMetrics">
                {item.latencyMs !== null && item.latencyMs !== undefined ? (
                  <span className="eventMetaPill">Latency: {formatNumber(item.latencyMs)} ms</span>
                ) : null}
                {item.uptimePercent !== null && item.uptimePercent !== undefined ? (
                  <span className="eventMetaPill">Uptime: {formatPercentLabel(item.uptimePercent)}</span>
                ) : null}
              </div>
            ) : null}
            {item.affectedTargets?.length ? (
              <div className="eventAttribute">
                <span>Affected Targets</span>
                <div className="eventTargetList">
                  {item.affectedTargets.map((target) => (
                    <span key={`${item.key || item.title}-${target}`}>{target}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {item.lastChecked ? (
              <div className="eventAttribute">
                <span>Last Checked</span>
                <TimestampValue value={item.lastChecked} />
              </div>
            ) : null}
            {item.externalUrl ? (
              <div className="eventAttribute">
                <span>Component Link</span>
                <a className="inlineLink" href={item.externalUrl} target="_blank" rel="noreferrer">
                  Open public status detail
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdditionalInfo = () => {
  const wallet = useWallet();
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transportMode, setTransportMode] = useState('polling');

  usePageMeta('Network', defaultExplorerDescription);

  const loadNetwork = useCallback(async () => {
    try {
      const [overviewPayload, summaryPayload] = await Promise.all([
        fetchNetworkOverview(),
        fetchExplorerSummary().catch(() => null)
      ]);

      setOverview(overviewPayload);
      setSummary(summaryPayload);
      setError(null);
    } catch (loadError) {
      setError(classifyExplorerError(loadError, { resourceLabel: 'network status' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  useRealtimeRefresh(
    async (mode) => {
      setTransportMode(mode);
      await loadNetwork();
    },
    { enabled: true, pollInterval: 5_000 }
  );

  const statusSnapshot = overview?.statusSnapshot || null;
  const nodes = Array.isArray(statusSnapshot?.nodes) ? statusSnapshot.nodes : [];
  const apiStatus = overview?.apiStatus || {};
  const activeAlerts = overview?.activeAlerts || [];
  const recentEvents = overview?.recentEvents || [];
  const componentStatuses = overview?.componentStatuses || [];
  const scheduledMaintenance = overview?.scheduledMaintenance || [];
  const incidentHistory = overview?.incidentHistory || [];
  const monitorSummary = overview?.monitorSummary || {};
  const delayed = Number(overview?.indexingLag || 0) > 0;
  const prefetchWallet = () => {
    void wallet.prefetch?.();
  };

  return (
    <div className="explorerPage">
      <PageHero
        eyebrow="Network Overview"
        title="Kamet Network Status"
        description="Chain health, indexing freshness, public endpoint status, latency, and monitored node availability for Kamet."
        actions={
          <>
            <button type="button" className="primary-btn" onClick={() => loadNetwork()}>
              Refresh
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => wallet.switchToLithoChain().catch(() => null)}
              onMouseEnter={prefetchWallet}
              onFocus={prefetchWallet}
              disabled={wallet.loading}
            >
              {wallet.loading ? 'Loading Wallet...' : 'Add Network'}
            </button>
            <a className="secondary-btn" href={CHAIN_CONFIG.statusPageUrl} target="_blank" rel="noreferrer">
              Open Status Page
            </a>
          </>
        }
      />

      {summary ? (
        <FreshnessPill
          indexedThroughBlock={summary.indexedThroughBlock}
          lastUpdated={summary.lastUpdated}
          transport={transportMode}
          staleData={summary.staleData || delayed}
        />
      ) : null}

      {error ? <ExplorerErrorState error={error} onRetry={loadNetwork} /> : null}

      {overview?.statusMessage && overview.chainHealth !== 'operational' ? (
        <SectionMessage tone={delayed ? 'error' : 'info'}>
          {overview.statusMessage}
          {delayed ? ' Indexing is behind the latest chain height, so some explorer panels may be delayed.' : ''}
        </SectionMessage>
      ) : null}

      <div className="explorerStats compact explorerStats-seven">
        <MetricCard label="Chain Health" value={overview?.chainHealth || '--'} subtext={overview?.statusMessage || 'Public status service'} loading={loading} tone={resolveStatusTone(overview?.chainHealth)} />
        <MetricCard label="Latency" value={overview?.latency !== null && overview?.latency !== undefined ? `${overview.latency} ms` : '--'} subtext="Average monitored endpoint latency" loading={loading} />
        <MetricCard label="TPS" value={overview?.tps !== null && overview?.tps !== undefined ? formatNumber(overview.tps) : '--'} subtext="Recent monitored throughput" loading={loading} />
        <MetricCard label="Indexing Lag" value={overview ? `${formatNumber(overview.indexingLag || 0)} blocks` : '--'} subtext={delayed ? 'Sections may be delayed' : 'Explorer is current'} loading={loading} tone={delayed ? 'info' : 'success'} />
        <MetricCard label="Latest Height" value={overview ? formatNumber(overview.latestHeight) : '--'} subtext={overview?.latestBlockTime ? <TimestampValue value={overview.latestBlockTime} /> : 'Live chain height'} loading={loading} />
        <MetricCard label="API Status" value={apiStatus.statusApi && apiStatus.rpc && apiStatus.rest ? 'Healthy' : 'Degraded'} subtext="Status API, RPC, and REST probes" loading={loading} tone={apiStatus.statusApi && apiStatus.rpc && apiStatus.rest ? 'success' : 'info'} />
        <MetricCard label="Recent Tx Window" value={overview?.recentTxCount !== null && overview?.recentTxCount !== undefined ? formatNumber(overview.recentTxCount) : '--'} subtext="Sampled transactions from status monitor" loading={loading} />
        <MetricCard label="Monitored Services" value={overview ? formatNumber(monitorSummary.componentCount || 0) : '--'} subtext="Component and derived health checks" loading={loading} />
        <MetricCard
          label="Maintenance"
          value={overview ? formatNumber(monitorSummary.maintenanceCount || 0) : '--'}
          subtext={
            monitorSummary.maintenanceCount
              ? 'Scheduled public maintenance windows'
              : 'No published maintenance windows'
          }
          loading={loading}
          tone={monitorSummary.maintenanceCount ? 'info' : 'success'}
        />
        <MetricCard
          label="Availability"
          value={
            monitorSummary.availabilityPercent !== null &&
            monitorSummary.availabilityPercent !== undefined
              ? formatPercentLabel(monitorSummary.availabilityPercent)
              : '--'
          }
          subtext="Published monitor availability"
          loading={loading}
          tone={
            monitorSummary.availabilityPercent !== null &&
            monitorSummary.availabilityPercent !== undefined &&
            monitorSummary.availabilityPercent >= 99
              ? 'success'
              : 'info'
          }
        />
      </div>

      <div className="explorerGrid two-up">
        <Panel title="Current State" description="Public status snapshot and recent incidents.">
          {loading && !overview ? (
            <LoadingSkeleton rows={5} />
          ) : (
            <div className="detailList">
              <div className="detailRow">
                <span>Status</span>
                <StatusBadge tone={resolveStatusTone(overview?.chainHealth)}>{overview?.chainHealth || 'unknown'}</StatusBadge>
              </div>
              <div className="detailRow">
                <span>Recent Incidents</span>
                <span>{activeAlerts.length ? `${formatNumber(activeAlerts.length)} active alert(s)` : 'No active alerts'}</span>
              </div>
              <div className="detailRow">
                <span>Scheduled Maintenance</span>
                <strong>
                  {monitorSummary.maintenanceCount
                    ? `${formatNumber(monitorSummary.maintenanceCount)} published window(s)`
                    : 'No published maintenance'}
                </strong>
              </div>
              <div className="detailRow">
                <span>Last Status Update</span>
                <TimestampValue value={statusSnapshot?.lastUpdated} />
              </div>
              <div className="detailRow">
                <span>Last State Change</span>
                <TimestampValue value={statusSnapshot?.lastStateChangeAt} />
              </div>
              <div className="detailRow">
                <span>Node Coverage</span>
                <strong>
                  {formatNumber(monitorSummary.onlineNodes || 0)} / {formatNumber(monitorSummary.totalNodes || 0)} online
                </strong>
              </div>
              <div className="detailRow">
                <span>Service Checks</span>
                <strong>{formatNumber(monitorSummary.componentCount || 0)}</strong>
              </div>
              <div className="detailRow">
                <span>Incident History</span>
                <strong>{formatNumber(monitorSummary.incidentHistoryCount || 0)}</strong>
              </div>
              <div className="detailRow">
                <span>Published Availability</span>
                <strong>
                  {monitorSummary.availabilityPercent !== null &&
                  monitorSummary.availabilityPercent !== undefined
                    ? formatPercentLabel(monitorSummary.availabilityPercent)
                    : '--'}
                </strong>
              </div>
              <div className="detailRow">
                <span>Metrics Feed Update</span>
                <TimestampValue value={monitorSummary.metricsLastUpdated} />
              </div>
              <div className="detailRow">
                <span>Chain ID</span>
                <strong>{CHAIN_CONFIG.chainId}</strong>
              </div>
              <div className="detailRow">
                <span>Currency Symbol</span>
                <strong>𝕃 ({CHAIN_CONFIG.denom})</strong>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Public Endpoints" description="Current production explorer endpoints and API probes.">
          <div className="detailList">
            <div className="detailRow">
              <span>RPC</span>
              <a href={CHAIN_CONFIG.rpcUrl} target="_blank" rel="noreferrer">{CHAIN_CONFIG.rpcUrl}</a>
            </div>
            <div className="detailRow">
              <span>REST</span>
              <a href={CHAIN_CONFIG.restUrl} target="_blank" rel="noreferrer">{CHAIN_CONFIG.restUrl}</a>
            </div>
            <div className="detailRow">
              <span>JSON-RPC</span>
              <a href={EvmAPI.rpcUrl} target="_blank" rel="noreferrer">{EvmAPI.rpcUrl}</a>
            </div>
            <div className="detailRow">
              <span>Status API</span>
              <StatusBadge tone={apiStatus.statusApi ? 'success' : 'failed'}>
                {apiStatus.statusApi ? 'Reachable' : 'Unavailable'}
              </StatusBadge>
            </div>
            <div className="detailRow">
              <span>RPC Probe</span>
              <StatusBadge tone={apiStatus.rpc ? 'success' : 'failed'}>
                {apiStatus.rpc ? 'Reachable' : 'Unavailable'}
              </StatusBadge>
            </div>
          </div>
        </Panel>

        <Panel title="Network Resources" description="Operational links for validators, governance, onboarding, and ecosystem tooling.">
          <div className="detailList">
            <div className="detailRow">
              <span>Docs</span>
              <a href={CHAIN_CONFIG.docsUrl} target="_blank" rel="noreferrer">
                Open docs
              </a>
            </div>
            <div className="detailRow">
              <span>Setup Guide</span>
              <a href={CHAIN_CONFIG.setupGuideUrl} target="_blank" rel="noreferrer">
                Open validator guide
              </a>
            </div>
            <div className="detailRow">
              <span>Validator Portal</span>
              <a href={CHAIN_CONFIG.validatorPortalUrl} target="_blank" rel="noreferrer">
                Open validator portal
              </a>
            </div>
            <div className="detailRow">
              <span>Governance API</span>
              <a href={CosmosAPI.proposals()} target="_blank" rel="noreferrer">
                Open governance proposals
              </a>
            </div>
            <div className="detailRow">
              <span>Ecosystem</span>
              <a href={CHAIN_CONFIG.ecosystemUrl} target="_blank" rel="noreferrer">
                Open ecosystem hub
              </a>
            </div>
            <div className="detailRow">
              <span>Faucet</span>
              <a href={CHAIN_CONFIG.faucetUrl} target="_blank" rel="noreferrer">
                Open faucet
              </a>
            </div>
          </div>
        </Panel>

        <Panel title="Address Formats" description="Kamet exposes Cosmos-native bech32 addresses alongside Lithosphere 0x addresses for the same account space.">
          <SectionMessage tone="info">
            Use <code>litho1...</code> first in Cosmos-native tools and staking flows. Use <code>0x...</code> in browser wallets and other Lithosphere-compatible wallets.
          </SectionMessage>
          <div className="detailList">
            <div className="detailRow multiLine">
              <span>Cosmos Account</span>
              <code>{`${CHAIN_CONFIG.bech32Prefix}1...`}</code>
            </div>
            <div className="detailRow multiLine">
              <span>Validator Address</span>
              <code>{`${CHAIN_CONFIG.validatorPrefix}1...`}</code>
            </div>
            <div className="detailRow multiLine">
              <span>Lithosphere Address</span>
              <code>0x...</code>
            </div>
            <div className="detailRow">
              <span>Bech32 Prefix</span>
              <strong>{CHAIN_CONFIG.bech32Prefix}</strong>
            </div>
            <div className="detailRow">
              <span>Validator Prefix</span>
              <strong>{CHAIN_CONFIG.validatorPrefix}</strong>
            </div>
            <div className="detailRow">
              <span>Currency Symbol</span>
              <strong>{LITHO_SYMBOL} ({CHAIN_CONFIG.denom})</strong>
            </div>
          </div>
        </Panel>
      </div>

      <div className="explorerGrid two-up">
        <Panel title="Service Health" description="Component-level public monitor breakdown, with derived API and indexer fallbacks when the feed is sparse.">
          {loading && !componentStatuses.length ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <ComponentStatusList
              items={componentStatuses}
              emptyTitle="No component health data"
              emptyDescription="The public status feed did not publish component-level health for this refresh."
            />
          )}
        </Panel>

        <Panel title="Active Incidents" description="Current unresolved alerts from the public status monitor.">
          <SectionMessage tone="info">
            Incident detail is limited to the fields published by the public status monitor. Some events may remain summary-only until the monitor exposes richer payloads.
          </SectionMessage>
          {loading && !overview ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <StatusActivityList
              items={activeAlerts}
              kind="incident"
              emptyTitle="No active alerts"
              emptyDescription="The public status monitor does not currently report any active Kamet incidents."
            />
          )}
        </Panel>
      </div>

      <div className="explorerGrid two-up">
        <Panel title="Recent Status Events" description="Recent status transitions and recovered alerts from the public monitor.">
          {loading && !overview ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <StatusActivityList
              items={recentEvents}
              kind="event"
              emptyTitle="No recent events"
              emptyDescription="The public status monitor has not published any recent Kamet events yet."
            />
          )}
        </Panel>

        <Panel title="Scheduled Maintenance" description="Upcoming or in-progress public maintenance windows published by the status monitor.">
          {loading && !overview ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <StatusActivityList
              items={scheduledMaintenance}
              kind="maintenance"
              emptyTitle="No scheduled maintenance"
              emptyDescription="The public status monitor has not published any upcoming Kamet maintenance windows."
            />
          )}
        </Panel>
      </div>

      <div className="explorerGrid two-up">
        <Panel title="Incident History" description="Resolved incidents and historical incident records exposed by the public status monitor.">
          {loading && !incidentHistory.length ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <StatusActivityList
              items={incidentHistory}
              kind="incident"
              emptyTitle="No incident history published"
              emptyDescription="The public status monitor did not expose historical incident records for this refresh."
            />
          )}
        </Panel>

        <Panel title="Status Coverage" description="Summary counts and service-state mix published by the monitor, with derived fallbacks when fields are missing.">
          <div className="detailList">
            <div className="detailRow">
              <span>Active Alerts</span>
              <strong>{formatNumber(monitorSummary.activeAlertCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Recent Events</span>
              <strong>{formatNumber(monitorSummary.recentEventCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Incident History</span>
              <strong>{formatNumber(monitorSummary.incidentHistoryCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Maintenance Windows</span>
              <strong>{formatNumber(monitorSummary.maintenanceCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Operational Components</span>
              <strong>{formatNumber(monitorSummary.operationalComponentCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Degraded Components</span>
              <strong>{formatNumber(monitorSummary.degradedComponentCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Unavailable Components</span>
              <strong>{formatNumber(monitorSummary.unavailableComponentCount || 0)}</strong>
            </div>
            <div className="detailRow">
              <span>Published Availability</span>
              <strong>
                {monitorSummary.availabilityPercent !== null &&
                monitorSummary.availabilityPercent !== undefined
                  ? formatPercentLabel(monitorSummary.availabilityPercent)
                  : '--'}
              </strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Monitored Endpoints" description="Status-page nodes and gateway checks for Kamet.">
        {loading && !nodes.length ? (
          <LoadingSkeleton rows={6} />
        ) : !nodes.length ? (
          <SectionMessage tone="info">No public node telemetry is available right now.</SectionMessage>
        ) : (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Probe</th>
                  <th>Sync</th>
                  <th>Latency</th>
                  <th>Height</th>
                  <th>Peers</th>
                  <th>Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr key={node.key}>
                    <td>
                      <div className="tableCellStack">
                        <strong>{node.displayName || node.label || node.endpoint}</strong>
                        <span>{node.endpoint}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={node.kind === 'gateway' ? 'info' : 'neutral'}>
                        {node.probe || node.kind || 'probe'}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={node.syncStatus === 'synced' ? 'success' : 'failed'}>
                        {node.syncStatus || 'unknown'}
                      </StatusBadge>
                    </td>
                    <td>{node.latency !== undefined ? `${node.latency} ms` : '--'}</td>
                    <td>{formatNumber(node.blockHeight || 0)}</td>
                    <td>{formatNumber(node.peersCount || 0)}</td>
                    <td>
                      <TimestampValue value={node.lastChecked} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};
