export const THANOS_RDNS = 'fi.thanos.wallet';
export const THANOS_INSTALL_URL = 'https://thanos.fi/';

type ConnectorIdentity = {
  name?: string | null;
  info?: { rdns?: string | null } | null;
};

export function isThanosIdentity(rdns?: string | null, name?: string | null): boolean {
  const normalizedRdns = rdns?.trim().toLowerCase() || '';
  const normalizedName = name?.trim().toLowerCase() || '';

  return normalizedRdns === THANOS_RDNS
    || normalizedRdns.includes('thanos')
    || normalizedName.includes('thanos');
}

export function isThanosConnector(connector: ConnectorIdentity): boolean {
  return isThanosIdentity(connector.info?.rdns, connector.name);
}

export function prioritizeThanosConnectors<T extends ConnectorIdentity>(
  connectors: T[],
): T[] {
  return connectors
    .map((connector, index) => ({ connector, index }))
    .sort((left, right) => {
      const leftPreferred = isThanosConnector(left.connector) ? 0 : 1;
      const rightPreferred = isThanosConnector(right.connector) ? 0 : 1;
      return leftPreferred - rightPreferred || left.index - right.index;
    })
    .map(({ connector }) => connector);
}
