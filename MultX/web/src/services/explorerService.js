import axios from 'axios';
import { CosmosAPI, EvmAPI } from '../config/api';
import {
  computeTxHash,
  normalizeTxHash,
  parseHexNumber,
  toEvmHash
} from '../helpers/explorer';

const DEFAULT_TX_LIMIT = 20;
const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_INITIAL_SCAN_WINDOW = 400;
const DEFAULT_MAX_SCAN_WINDOW = 5000;

export const fetchLatestBlock = async () => {
  const { data } = await axios.get(CosmosAPI.latestBlockRest());
  return data.block;
};

export const fetchLatestHeight = async () => {
  const block = await fetchLatestBlock();
  return Number(block?.header?.height || 0);
};

export const fetchBlockByHeight = async (height) => {
  const { data } = await axios.get(CosmosAPI.blockByHeightRest(height));
  return data.block;
};

export const fetchBlockMetas = async (minHeight, maxHeight) => {
  const { data } = await axios.get(CosmosAPI.blockchain(minHeight, maxHeight));
  return data?.result?.block_metas || [];
};

export const fetchRecentBlockMetas = async (count = 20) => {
  const latestHeight = await fetchLatestHeight();
  const minHeight = Math.max(latestHeight - count + 1, 1);
  const metas = await fetchBlockMetas(minHeight, latestHeight);

  return metas
    .map((meta) => ({
      ...meta,
      header: meta.header || {}
    }))
    .sort((left, right) => Number(right.header.height) - Number(left.header.height));
};

const postEvmRpc = async (payload) => {
  const { data } = await axios.post(EvmAPI.rpcUrl, payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (data?.error) {
    throw new Error(data.error.message || 'RPC request failed.');
  }

  return data?.result ?? null;
};

const mapEvmTransactionResponse = ({ hash, transaction, receipt, block }) => ({
  source: 'EVM',
  txhash: normalizeTxHash(hash),
  evmHash: toEvmHash(hash),
  height: parseHexNumber(transaction?.blockNumber),
  blockNumber: parseHexNumber(transaction?.blockNumber),
  timestamp: block?.timestamp
    ? new Date(parseHexNumber(block.timestamp) * 1000).toISOString()
    : '',
  code:
    receipt?.status === '0x1'
      ? 0
      : receipt?.status === '0x0'
        ? 1
        : null,
  from: transaction?.from || '',
  to: transaction?.to || '',
  value: transaction?.value || '0x0',
  nonce: parseHexNumber(transaction?.nonce),
  gas_wanted: parseHexNumber(transaction?.gas),
  gas_used: parseHexNumber(receipt?.gasUsed),
  gasPrice:
    receipt?.effectiveGasPrice ||
    transaction?.gasPrice ||
    transaction?.maxFeePerGas ||
    '0x0',
  effectiveGasPrice: receipt?.effectiveGasPrice || '',
  maxFeePerGas: transaction?.maxFeePerGas || '',
  maxPriorityFeePerGas: transaction?.maxPriorityFeePerGas || '',
  transactionIndex: parseHexNumber(transaction?.transactionIndex),
  chainId: parseHexNumber(transaction?.chainId),
  type: transaction?.type || '0x0',
  input: transaction?.input || '0x',
  logs: receipt?.logs || [],
  status: receipt?.status || '',
  rawTransaction: transaction || null,
  rawReceipt: receipt || null,
  rawBlock: block || null
});

const fetchEvmTransactionByHash = async (hash) => {
  const evmHash = toEvmHash(hash);
  const [transaction, receipt] = await Promise.all([
    postEvmRpc(EvmAPI.txByHash(evmHash)),
    postEvmRpc(EvmAPI.txReceipt(evmHash)).catch(() => null)
  ]);

  if (!transaction) {
    throw new Error('Transaction not found.');
  }

  const block = transaction?.blockNumber
    ? await postEvmRpc(EvmAPI.blockByNumber(transaction.blockNumber)).catch(() => null)
    : null;

  return mapEvmTransactionResponse({
    hash: evmHash,
    transaction,
    receipt,
    block
  });
};

const getEventAttributeValues = (events = [], eventType, key) =>
  (Array.isArray(events) ? events : [])
    .filter((event) => event?.type === eventType)
    .flatMap((event) => event?.attributes || [])
    .filter((attribute) => attribute?.key === key)
    .map((attribute) => String(attribute.value || '').trim())
    .filter(Boolean);

const matchesEvmHash = (txResponse, evmHash) => {
  const normalizedEvmHash = toEvmHash(evmHash).toLowerCase();

  if (!normalizedEvmHash) {
    return false;
  }

  return getEventAttributeValues(txResponse?.events, 'ethereum_tx', 'ethereumTxHash').some(
    (candidate) => candidate.toLowerCase() === normalizedEvmHash
  );
};

export const fetchTransactionByHash = async (hash) => {
  const normalizedHash = normalizeTxHash(hash);
  const prefersEvm = String(hash || '').trim().startsWith('0x');

  if (prefersEvm) {
    try {
      return await fetchEvmTransactionByHash(hash);
    } catch (error) {
      if (!/not found/i.test(error?.message || '')) {
        throw error;
      }
    }
  }

  try {
    const { data } = await axios.get(CosmosAPI.txByHash(normalizedHash));
    return data.tx_response || data;
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }

    return fetchEvmTransactionByHash(hash);
  }
};

export const fetchCosmosTransactionByHash = async (hash) => {
  const cosmosHash = normalizeTxHash(hash);
  try {
    const { data } = await axios.get(CosmosAPI.txByHash(cosmosHash));
    return data.tx_response || null;
  } catch {
    return null;
  }
};

export const fetchCosmosTransactionByEvmHash = async (evmHash, blockHeight = 0) => {
  const directMatch = await fetchCosmosTransactionByHash(evmHash);

  if (directMatch) {
    return directMatch;
  }

  const normalizedBlockHeight = Number(blockHeight || 0);

  if (!normalizedBlockHeight) {
    return null;
  }

  try {
    const { data } = await axios.get(CosmosAPI.txsQuery(`tx.height=${normalizedBlockHeight}`, 100, 0));
    const responses = Array.isArray(data?.tx_responses) ? data.tx_responses : [];

    return responses.find((txResponse) => matchesEvmHash(txResponse, evmHash)) || null;
  } catch {
    return null;
  }
};

const buildTransactionRecord = (txResponse, fallback = {}) => ({
  hash: normalizeTxHash(txResponse?.txhash || fallback.hash || ''),
  evmHash: toEvmHash(txResponse?.txhash || fallback.hash || ''),
  blockHeight: Number(txResponse?.height || fallback.blockHeight || 0),
  timestamp: txResponse?.timestamp || fallback.timestamp || '',
  txResponse
});

const normalizePositiveInteger = (value, fallback) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.trunc(numeric);
};

const resolveTransactionScanWindows = ({
  scanWindow,
  initialScanWindow = DEFAULT_INITIAL_SCAN_WINDOW,
  maxScanWindow = DEFAULT_MAX_SCAN_WINDOW
} = {}) => {
  if (scanWindow !== undefined) {
    const boundedWindow = normalizePositiveInteger(scanWindow, DEFAULT_INITIAL_SCAN_WINDOW);
    return {
      initialScanWindow: boundedWindow,
      maxScanWindow: boundedWindow
    };
  }

  const resolvedInitialWindow = normalizePositiveInteger(initialScanWindow, DEFAULT_INITIAL_SCAN_WINDOW);
  const resolvedMaxWindow = Math.max(
    resolvedInitialWindow,
    normalizePositiveInteger(maxScanWindow, DEFAULT_MAX_SCAN_WINDOW)
  );

  return {
    initialScanWindow: resolvedInitialWindow,
    maxScanWindow: resolvedMaxWindow
  };
};

const collectTransactionsFromRange = async ({
  startHeight,
  windowSize,
  limit,
  batchSize,
  seen,
  collected
}) => {
  let currentMax = startHeight;
  let scanned = 0;

  while (currentMax > 0 && scanned < windowSize && collected.length < limit) {
    const remainingWindow = windowSize - scanned;
    const currentBatchSize = Math.min(batchSize, remainingWindow);
    const minHeight = Math.max(currentMax - currentBatchSize + 1, 1);
    const metas = await fetchBlockMetas(minHeight, currentMax);
    const blocksWithTransactions = metas
      .filter((meta) => Number(meta?.num_txs || 0) > 0)
      .sort((left, right) => Number(right.header.height) - Number(left.header.height));

    for (const meta of blocksWithTransactions) {
      const height = Number(meta?.header?.height || 0);
      const block = await fetchBlockByHeight(height).catch(() => null);
      const txs = block?.data?.txs || [];

      if (txs.length === 0) {
        continue;
      }

      const hashes = await Promise.all(txs.map((tx) => computeTxHash(tx)));

      for (const hash of hashes) {
        if (!hash || seen.has(hash)) {
          continue;
        }

        seen.add(hash);

        const txResponse = await fetchTransactionByHash(hash).catch(() => null);

        if (!txResponse) {
          continue;
        }

        collected.push(
          buildTransactionRecord(txResponse, {
            hash,
            blockHeight: height,
            timestamp: meta?.header?.time || block?.header?.time || ''
          })
        );

        if (collected.length >= limit) {
          break;
        }
      }

      if (collected.length >= limit) {
        break;
      }
    }

    scanned += currentMax - minHeight + 1;
    currentMax = minHeight - 1;
  }

  return currentMax;
};

export const mergeRecentTransactions = (incoming = [], existing = [], limit = DEFAULT_TX_LIMIT) => {
  const boundedLimit = normalizePositiveInteger(limit, DEFAULT_TX_LIMIT);
  const seen = new Set();
  const merged = [];

  for (const transaction of [...incoming, ...existing]) {
    const hash = normalizeTxHash(transaction?.hash || transaction?.txResponse?.txhash || '');

    if (!hash || seen.has(hash)) {
      continue;
    }

    seen.add(hash);
    merged.push({
      ...transaction,
      hash,
      evmHash: transaction?.evmHash || toEvmHash(hash)
    });

    if (merged.length >= boundedLimit) {
      break;
    }
  }

  return merged;
};

export const fetchTransactionsForBlock = async (height, txs = []) => {
  const hashes = await Promise.all(txs.map((tx) => computeTxHash(tx)));
  const responses = await Promise.all(
    hashes
      .filter(Boolean)
      .map((hash) =>
        fetchTransactionByHash(hash)
          .then((txResponse) =>
            buildTransactionRecord(txResponse, {
              hash,
              blockHeight: height
            })
          )
          .catch(() => null)
      )
  );

  return responses.filter(Boolean);
};

export const fetchRecentTransactions = async ({
  limit = DEFAULT_TX_LIMIT,
  batchSize = DEFAULT_BATCH_SIZE,
  scanWindow,
  initialScanWindow = DEFAULT_INITIAL_SCAN_WINDOW,
  maxScanWindow = DEFAULT_MAX_SCAN_WINDOW
} = {}) => {
  const boundedLimit = normalizePositiveInteger(limit, DEFAULT_TX_LIMIT);
  const boundedBatchSize = normalizePositiveInteger(batchSize, DEFAULT_BATCH_SIZE);
  const windows = resolveTransactionScanWindows({
    scanWindow,
    initialScanWindow,
    maxScanWindow
  });
  const latestHeight = await fetchLatestHeight();
  const collected = [];
  const seen = new Set();

  let nextHeight = latestHeight;

  nextHeight = await collectTransactionsFromRange({
    startHeight: nextHeight,
    windowSize: windows.initialScanWindow,
    limit: boundedLimit,
    batchSize: boundedBatchSize,
    seen,
    collected
  });

  const remainingWindow = windows.maxScanWindow - windows.initialScanWindow;

  if (collected.length < boundedLimit && remainingWindow > 0 && nextHeight > 0) {
    await collectTransactionsFromRange({
      startHeight: nextHeight,
      windowSize: remainingWindow,
      limit: boundedLimit,
      batchSize: boundedBatchSize,
      seen,
      collected
    });
  }

  return collected;
};
