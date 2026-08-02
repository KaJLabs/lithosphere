import { ethers } from 'ethers';
import { config, resolveReleaseToken } from '../config.js';
import { pool } from '../db/pool.js';

const BRIDGE_ABI = [
  'event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 targetChain, uint256 nonce)'
];

const MAX_BACKOFF_MS = 30_000;

// Public RPCs cap eth_getLogs block ranges (BNB testnet rejects wide windows
// with -32005 "limit exceeded"). Without a clamp, a watcher that falls behind
// past the cap can never advance lastBlock: every poll re-requests the same
// oversized range, fails, and the watcher wedges permanently. Walking forward
// in bounded chunks keeps every query under the cap and catches up on its own.
const MAX_BLOCKS_PER_POLL = 2_000;

// Per-chain state (one entry per chainsToWatch row)
const watchers = new Map();

const backoffMs = (attempts) => Math.min(2000 * 2 ** attempts, MAX_BACKOFF_MS);

function makeWatcher(spec) {
  return {
    spec,
    provider: null,
    contract: null,
    lastBlock: 0,
    consecutiveErrors: 0,
    pollTimer: null,
    retryTimer: null,
    // Guards that prevent a transient RPC blip from multiplying into a
    // connection storm (which previously exhausted local ports -> EADDRNOTAVAIL
    // and permanently wedged the watcher): only one connect and one poll may be
    // in flight at a time, and only one reconnect may be scheduled.
    reconnecting: false,
    polling: false,
  };
}

// Kill any interval/retry timers so we never leave orphaned setInterval()s
// running (each orphan polled independently and opened its own connections).
function clearTimers(w) {
  if (w.pollTimer) { clearInterval(w.pollTimer); w.pollTimer = null; }
  if (w.retryTimer) { clearTimeout(w.retryTimer); w.retryTimer = null; }
}

// Idempotent: schedules at most ONE reconnect, with backoff on consecutive errors.
function scheduleReconnect(spec, w) {
  if (w.retryTimer) return;             // a reconnect is already pending
  clearTimers(w);                       // stop polling until we're reconnected
  const delay = backoffMs(w.consecutiveErrors);
  console.warn(`[EventListener:${spec.name}] Reconnecting in ${delay / 1000}s (attempt ${w.consecutiveErrors})`);
  w.retryTimer = setTimeout(() => { w.retryTimer = null; startWatcher(spec); }, delay);
}

async function pollChain(name) {
  const w = watchers.get(name);
  if (!w || !w.provider || !w.contract) return;
  if (w.polling) return;                // previous poll still running — skip this tick
  w.polling = true;
  try {
    const currentBlock = await w.provider.getBlockNumber();
    if (currentBlock > w.lastBlock) {
      const toBlock = Math.min(currentBlock, w.lastBlock + MAX_BLOCKS_PER_POLL);
      const filter = w.contract.filters.TokensLocked();
      const events = await w.contract.queryFilter(filter, w.lastBlock + 1, toBlock);

      for (const event of events) {
        const { txHash, token, user, amount, targetChain, nonce } = event.args;
        const releaseChain = Number(targetChain.toString());
        const releaseToken = resolveReleaseToken(w.spec.chainId, token, releaseChain);

        console.log(
          `[EventListener:${name}] TokensLocked txHash=${txHash.slice(0, 10)}… ` +
          `token=${token.slice(0, 10)}… user=${user.slice(0, 10)}… ` +
          `source=${w.spec.chainId} target=${releaseChain} release_token=${releaseToken ?? 'UNMAPPED'}`
        );

        if (!releaseToken) {
          console.warn(
            `[EventListener:${name}] No release_token mapping for ` +
            `(source=${w.spec.chainId}, token=${token}, target=${releaseChain}). Row skipped.`
          );
          continue;
        }

        try {
          await pool.query(
            `INSERT INTO bridge_transactions
               (tx_hash, from_address, token_address, amount, target_chain,
                source_chain, source_nonce, release_token, status, block_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'locked', $9)
             ON CONFLICT (tx_hash) DO UPDATE SET
               status='locked',
               block_number=$9,
               source_chain=EXCLUDED.source_chain,
               release_token=EXCLUDED.release_token`,
            [
              txHash,
              user,
              token,
              amount.toString(),
              releaseChain,
              w.spec.chainId,
              nonce.toString(),
              releaseToken,
              event.blockNumber,
            ]
          );
        } catch (err) {
          console.error(`[EventListener:${name}] DB error:`, err.message);
        }
      }

      w.lastBlock = toBlock;
    }
    w.consecutiveErrors = 0;
  } catch (err) {
    console.error(`[EventListener:${name}] Poll error: ${err.message}`);
    w.consecutiveErrors++;
    scheduleReconnect(w.spec, w);       // idempotent — never piles up retries
  } finally {
    w.polling = false;
  }
}

async function startWatcher(spec) {
  if (!spec.bridge) {
    console.warn(`[EventListener:${spec.name}] No bridge address configured — skipping.`);
    return;
  }

  const w = watchers.get(spec.name) ?? makeWatcher(spec);
  watchers.set(spec.name, w);

  if (w.reconnecting) return;           // single-flight: don't spawn a parallel connect
  w.reconnecting = true;
  clearTimers(w);                       // clear any prior interval/retry before reconnecting

  try {
    w.provider = new ethers.providers.StaticJsonRpcProvider(spec.rpc, { chainId: spec.chainId, name: spec.name });
    await w.provider.getNetwork();
    const currentBlock = await w.provider.getBlockNumber();
    // Preserve progress across reconnects so a blip doesn't skip locks; only
    // cold-start from the chain tip on the very first successful connect.
    if (!w.lastBlock) w.lastBlock = currentBlock;
    w.consecutiveErrors = 0;
    w.contract = new ethers.Contract(spec.bridge, BRIDGE_ABI, w.provider);

    console.log(
      `[EventListener:${spec.name}] Connected — chainId=${spec.chainId} bridge=${spec.bridge}; ` +
      `polling from block ${w.lastBlock} every ${spec.pollMs}ms`
    );
    w.pollTimer = setInterval(() => { pollChain(spec.name); }, spec.pollMs);
  } catch (err) {
    console.error(`[EventListener:${spec.name}] Connect error: ${err.message}`);
    w.consecutiveErrors++;
    scheduleReconnect(spec, w);
  } finally {
    w.reconnecting = false;
  }
}

export async function startEventListener() {
  const chains = config.chainsToWatch || [];
  if (chains.length === 0) {
    console.warn('[EventListener] No chainsToWatch configured — listener inactive.');
    return;
  }
  console.log(`[EventListener] Starting ${chains.length} parallel chain watcher(s)`);
  // Spawn all in parallel — each restarts independently on failure.
  await Promise.all(chains.map((c) => startWatcher(c).catch((e) =>
    console.error(`[EventListener:${c.name}] Initial start failed: ${e.message}`)
  )));
}

export function getProvider() {
  // Backwards-compat — returns the Kamet provider if present.
  const kamet = watchers.get('kamet');
  return kamet?.provider ?? null;
}
