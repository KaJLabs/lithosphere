import { useEffect, useRef, useState } from 'react';
import { CHAIN_CONFIG } from '../config/api';
import { safeJsonParse } from '../helpers/explorer';

const SUBSCRIPTION_ID = 'kamet-explorer-realtime';

const MIN_WS_REFRESH_MS = 500;

export const useRealtimeRefresh = (
  onRefresh,
  { enabled = true, pollInterval = 30_000, query = "tm.event='NewBlock'" } = {}
) => {
  const refreshRef = useRef(onRefresh);
  const lastRefreshRef = useRef(0);
  const [transport, setTransport] = useState('polling');

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const minRefreshMs = Math.max(MIN_WS_REFRESH_MS, pollInterval);
    let websocket = null;
    let pollTimer = null;
    let closed = false;

    const startPolling = () => {
      if (pollTimer) {
        return;
      }

      setTransport('polling');
      pollTimer = window.setInterval(() => {
        refreshRef.current?.('polling');
      }, pollInterval);
    };

    try {
      websocket = new WebSocket(CHAIN_CONFIG.explorerWsUrl);

      websocket.onopen = () => {
        setTransport('websocket');
        websocket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'subscribe',
            id: SUBSCRIPTION_ID,
            params: {
              query
            }
          })
        );
      };

      websocket.onmessage = (event) => {
        const payload = safeJsonParse(event.data, {});
        const isSubscriptionEvent =
          payload?.result?.query || payload?.result?.data || payload?.method === 'subscription';

        if (isSubscriptionEvent) {
          const now = Date.now();
          if (now - lastRefreshRef.current >= minRefreshMs) {
            lastRefreshRef.current = now;
            refreshRef.current?.('websocket');
          }
        }
      };

      websocket.onerror = () => {
        if (!closed) {
          startPolling();
        }
      };

      websocket.onclose = () => {
        if (!closed) {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      closed = true;

      if (pollTimer) {
        window.clearInterval(pollTimer);
      }

      if (websocket && websocket.readyState <= 1) {
        websocket.close();
      }
    };
  }, [enabled, pollInterval, query]);

  return {
    transport
  };
};
