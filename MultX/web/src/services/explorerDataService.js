import axios from 'axios';
import { ethers } from 'ethers5';
import { bech32 } from 'bech32';
import { CHAIN_CONFIG, CosmosAPI, EvmAPI } from '../config/api';
import {
  detectAddressType,
  formatCoin,
  formatDurationSeconds,
  formatFeeCoin,
  formatGasPrice,
  formatPercent,
  formatRelativeTime,
  formatTokenAmount,
  hexToDecimalString,
  isSameAddress,
  looksLikeAddress,
  looksLikeBlockHash,
  looksLikeHeight,
  looksLikeTxHash,
  looksLikeValidatorOperator,
  normalizeAddress,
  normalizeTxHash,
  safeJsonParse,
  sanitizeSearchInput,
  toBech32Address,
  toChecksumAddress,
  toEvmHash,
  toHexAddress
} from '../helpers/explorer';
import { detectMalformedSearchInput } from '../helpers/explorerErrors';
import {
  fetchBlockMetas,
  fetchCosmosTransactionByEvmHash,
  fetchLatestBlock,
  fetchLatestHeight,
  fetchRecentTransactions,
  fetchTransactionByHash,
  fetchTransactionsForBlock
} from './explorerService';
import {
  fetchAllValidators,
  getPublicValidators,
  getValidatorDisplayName,
  getValidatorDisplayStatus,
  getValidatorVotingPower,
  sortValidators
} from './validatorService';
import {
  KAMET_KNOWN_CONTRACTS,
  KAMET_KNOWN_CONTRACTS_BY_ADDRESS,
  KAMET_KNOWN_TOKENS,
  KAMET_KNOWN_TOKENS_BY_ADDRESS,
  KAMET_TOKEN_SYMBOL_INDEX,
  ERC20_ABI,
  ERC721_ABI
} from '../data/kametRegistry';
import { captureExplorerError } from './errorTracking';

const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 10000;
const RECENT_LOOKBACK_BLOCKS = Number(import.meta.env.VITE_RECENT_LOOKBACK_BLOCKS) || 20_000;
const RECENT_TRANSACTION_SCAN_INITIAL_BLOCKS =
  Number(import.meta.env.VITE_RECENT_TRANSACTION_SCAN_INITIAL_BLOCKS) || 2_000;
const RECENT_TRANSACTION_SCAN_MAX_BLOCKS =
  Number(import.meta.env.VITE_RECENT_TRANSACTION_SCAN_MAX_BLOCKS) || 50_000;
const RECENT_TRANSACTION_SCAN_BATCH_SIZE =
  Number(import.meta.env.VITE_RECENT_TRANSACTION_SCAN_BATCH_SIZE) || 100;
const TOKEN_LEDGER_CHUNK_SIZE = Number(import.meta.env.VITE_TOKEN_LEDGER_CHUNK_SIZE) || 5000;
const TRACE_LOOKBACK_BLOCKS = Number(import.meta.env.VITE_TRACE_LOOKBACK_BLOCKS) || 5000;
const TRACE_RESULT_LIMIT = Number(import.meta.env.VITE_TRACE_RESULT_LIMIT) || 100;
const PAGE_SIZE = 15;
const TTL_REALTIME = 5_000;
const TTL_SHORT = 12_000;
const TTL_MEDIUM = 30_000;
const TTL_LONG = 60_000;
const TRANSFER_EVENT_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');
const TRANSFER_SINGLE_TOPIC = ethers.utils.id(
  'TransferSingle(address,address,address,uint256,uint256)'
);
const TRANSFER_BATCH_TOPIC = ethers.utils.id(
  'TransferBatch(address,address,address,uint256[],uint256[])'
);
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ERC20_TRANSFER_INTERFACE = new ethers.utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);
const ERC1155_INTERFACE = new ethers.utils.Interface([
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);

const http = axios.create({
  timeout: API_TIMEOUT
});

const publicProvider = new ethers.providers.JsonRpcProvider(EvmAPI.rpcUrl, CHAIN_CONFIG.evmChainId);
const requestCache = new Map();
const inFlightCache = new Map();

// staleWhileRevalidate: when true and a stale entry exists, return the stale
// value immediately and kick off a background refresh so the next render gets
// fresh data without blocking. Callers that need real-time accuracy (block
// height, gas price) should leave this false.
const withCache = async (key, ttlMs, loader, { staleWhileRevalidate = false } = {}) => {
  const now = Date.now();
  const cached = requestCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlightCache.has(key)) {
    // Already fetching — return stale if available, otherwise wait
    if (staleWhileRevalidate && cached) return cached.value;
    return inFlightCache.get(key);
  }

  const promise = loader().then(
    (value) => {
      requestCache.set(key, { expiresAt: Date.now() + ttlMs, value });
      inFlightCache.delete(key);
      return value;
    },
    (error) => {
      inFlightCache.delete(key);
      throw error;
    }
  );

  inFlightCache.set(key, promise);

  if (staleWhileRevalidate && cached) {
    // Fire background fetch; return stale immediately without blocking
    promise.catch(() => {});
    return cached.value;
  }

  return promise;
};

const readExplorerApi = async (path) => {
  if (!CHAIN_CONFIG.explorerDataApiUrl) {
    return null;
  }

  try {
    const response = await http.get(`${CHAIN_CONFIG.explorerDataApiUrl}${path}`, {
      transformResponse: [(value) => value]
    });
    const contentType = response.headers?.['content-type'] || '';

    if (!contentType.includes('application/json')) {
      return null;
    }

    return safeJsonParse(response.data, null);
  } catch {
    return null;
  }
};

const postEvmRpc = async (payload) => {
  const { data } = await http.post(EvmAPI.rpcUrl, payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (data?.error) {
    throw new Error(data.error.message || 'RPC request failed.');
  }

  return data?.result ?? null;
};

const normalizeMetadataUri = (value = '') => {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${trimmed.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  }

  return trimmed;
};

const decodeDataUriJson = (value = '') => {
  const trimmed = String(value || '').trim();

  if (!trimmed.startsWith('data:')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(',');
  if (separatorIndex < 0) {
    return null;
  }

  const header = trimmed.slice(0, separatorIndex);
  const payload = trimmed.slice(separatorIndex + 1);

  try {
    const decoded = header.includes(';base64')
      ? atob(payload)
      : decodeURIComponent(payload);
    return safeJsonParse(decoded, null);
  } catch {
    return null;
  }
};

const readMetadataDocument = async (uri = '') => {
  const normalizedUri = normalizeMetadataUri(uri);

  if (!normalizedUri) {
    return null;
  }

  if (normalizedUri.startsWith('data:')) {
    return decodeDataUriJson(normalizedUri);
  }

  if (!/^https?:\/\//i.test(normalizedUri)) {
    return null;
  }

  try {
    const { data } = await http.get(normalizedUri, {
      transformResponse: [(value) => value]
    });
    return typeof data === 'string' ? safeJsonParse(data, null) : data;
  } catch {
    return null;
  }
};

const normalizeMetadataImage = (value = '') => normalizeMetadataUri(value);

const callOptionalContractMethod = async (contract, methodName, fallback = '') => {
  if (!contract || typeof contract[methodName] !== 'function') {
    return fallback;
  }

  try {
    return await contract[methodName]();
  } catch {
    return fallback;
  }
};

const bytesFromBase64 = (value = '') => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const bytesToHex = (bytes = []) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

const bytesToBech32 = (bytes, prefix) => bech32.encode(prefix, bech32.toWords(bytes));

const digestConsensusPubkey = async (pubkeyBase64 = '') => {
  if (!pubkeyBase64) {
    return {
      proposerHex: '',
      consensusAddress: ''
    };
  }

  const bytes = bytesFromBase64(pubkeyBase64);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const addressBytes = new Uint8Array(hashBuffer).slice(0, 20);

  return {
    proposerHex: bytesToHex(addressBytes),
    consensusAddress: bytesToBech32(addressBytes, `${CHAIN_CONFIG.bech32Prefix}valcons`)
  };
};

const getKnownContract = (address = '') =>
  KAMET_KNOWN_CONTRACTS_BY_ADDRESS.get(String(address || '').toLowerCase()) || null;

const getKnownToken = (address = '') =>
  KAMET_KNOWN_TOKENS_BY_ADDRESS.get(String(address || '').toLowerCase()) || null;

const buildContractInterface = (abi = []) => {
  try {
    return abi.length ? new ethers.utils.Interface(abi) : null;
  } catch {
    return null;
  }
};

const buildAmountParts = (value = '') => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^([0-9]+)([a-zA-Z][a-zA-Z0-9/:-]*)$/);
  return match
    ? {
        amount: match[1],
        denom: match[2]
      }
    : null;
};

const getEventAttributes = (events = [], type, key) => {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter((event) => event?.type === type)
    .flatMap((event) => event?.attributes || [])
    .filter((attribute) => attribute?.key === key)
    .map((attribute) => attribute.value)
    .filter(Boolean);
};

const pickLargestAmount = (values = []) => {
  let current = null;

  for (const value of values) {
    const parsed = buildAmountParts(value);

    if (!parsed) {
      continue;
    }

    if (!current) {
      current = parsed;
      continue;
    }

    if (BigInt(parsed.amount) > BigInt(current.amount)) {
      current = parsed;
    }
  }

  return current;
};

const selectMessageAmount = (message = {}) => {
  if (Array.isArray(message.amount) && message.amount[0]) {
    return {
      amount: String(message.amount[0].amount || '0'),
      denom: message.amount[0].denom || CHAIN_CONFIG.baseDenom
    };
  }

  if (message?.data?.value !== undefined && message?.data?.value !== null) {
    return {
      amount: String(message.data.value),
      denom: CHAIN_CONFIG.baseDenom
    };
  }

  return null;
};

const MSG_TYPE_LABELS = {
  EthereumTx: 'Txn'
};

const normalizeMessageType = (type = '') => {
  if (!type) {
    return 'Transaction';
  }

  const lastSlashPart = type.replace(/^\//, '').split('/').pop() || type;
  const lastSegment = lastSlashPart.split('.').pop() || lastSlashPart;
  const label = lastSegment.replace(/^Msg/, '') || 'Transaction';
  return MSG_TYPE_LABELS[label] ?? label;
};

const normalizeTxType = (message = {}) => {
  const typeUrl = message?.['@type'] || '';

  if (/MsgEthereumTx$/.test(typeUrl)) {
    return message?.data?.to ? 'contract' : 'transfer';
  }

  if (/MsgSend$/.test(typeUrl)) {
    return 'transfer';
  }

  if (/MsgDelegate|MsgUndelegate|MsgBeginRedelegate/.test(typeUrl)) {
    return 'staking';
  }

  return 'transaction';
};

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

// MsgEthereumTx.data.data arrives as base64 from the cosmos LCD but as 0x-hex from
// other code paths. Normalize both to a 0x-hex string so selector matching works.
const normalizeEvmCalldata = (raw) => {
  if (typeof raw !== 'string' || !raw) return '';
  if (raw.startsWith('0x') || raw.startsWith('0X')) return raw.toLowerCase();
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return `0x${raw.toLowerCase()}`;
  }
  try {
    const bytes = typeof globalThis.Buffer !== 'undefined'
      ? globalThis.Buffer.from(raw, 'base64')
      : Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    if (!bytes.length) return '';
    let hex = '0x';
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return '';
  }
};

const ERC721_MINT_TO_SELECTOR = '0x9f6ed25f';
const ERC721_TRANSFER_FROM_SELECTOR = '0x23b872dd';
const ERC721_SAFE_TRANSFER_FROM_SELECTOR = '0x42842e0e';

const decodeLep100Transfer = (message) => {
  const evmTo = message?.data?.to;
  const calldata = normalizeEvmCalldata(message?.data?.data);

  if (!evmTo || !calldata || calldata.length < 10) {
    return null;
  }
  if (calldata.slice(0, 10) !== ERC20_TRANSFER_SELECTOR) {
    return null;
  }

  const knownToken = getKnownToken(evmTo);
  if (!knownToken || knownToken.type !== 'LEP100') {
    return null;
  }

  const decoded = decodeKnownInput(evmTo, calldata);
  if (!decoded || decoded.name !== 'transfer') {
    return null;
  }

  const recipient = decoded.args?.to || decoded.args?.recipient || decoded.args?._to;
  const amount = decoded.args?.amount || decoded.args?.value || decoded.args?._value;
  if (!recipient || !amount) {
    return null;
  }

  return { token: knownToken, recipient, amount: String(amount) };
};

const decodeNftCall = (message) => {
  const evmTo = message?.data?.to;
  const calldata = normalizeEvmCalldata(message?.data?.data);

  if (!evmTo || !calldata || calldata.length < 10) {
    return null;
  }

  const selector = calldata.slice(0, 10);
  if (
    selector !== ERC721_MINT_TO_SELECTOR &&
    selector !== ERC721_TRANSFER_FROM_SELECTOR &&
    selector !== ERC721_SAFE_TRANSFER_FROM_SELECTOR
  ) {
    return null;
  }

  const knownToken = getKnownToken(evmTo);
  if (!knownToken || knownToken.type !== 'NFT') {
    return null;
  }

  const decoded = decodeKnownInput(evmTo, calldata);
  if (!decoded) {
    return null;
  }

  const recipient = decoded.args?.to || decoded.args?._to;
  const tokenId =
    decoded.args?.tokenId ?? decoded.args?._tokenId ?? decoded.args?.id ?? null;
  if (!recipient || tokenId === null || tokenId === undefined) {
    return null;
  }

  const method = decoded.name === 'mintTo' ? 'Mint' : 'Transfer';
  return { token: knownToken, recipient, tokenId: String(tokenId), method };
};

const mapLiveTransaction = ({ tx, tx_response: txResponse }) => {
  const message = tx?.body?.messages?.[0] || {};
  const isEvmMessage = message?.['@type'] === '/ethermint.evm.v1.MsgEthereumTx';
  const feeCoin = tx?.auth_info?.fee?.amount?.[0] || null;
  const transferAmount =
    pickLargestAmount(
      getEventAttributes(txResponse?.events, 'transfer', 'amount').filter((value) => {
        if (!feeCoin) {
          return true;
        }

        const parsed = buildAmountParts(value);
        return !(parsed && parsed.amount === feeCoin.amount && parsed.denom === feeCoin.denom);
      })
    ) || selectMessageAmount(message);

  const cosmosFrom =
    message.from_address ||
    message.sender ||
    getEventAttributes(txResponse?.events, 'message', 'sender')[0] ||
    '';

  // For EVM-wrapped txs, the only cosmos `transfer` event is the fee payment to fee_collector.
  // Treating that as a recipient is wrong, so skip transfer-event recipient resolution entirely
  // for MsgEthereumTx — rely on the EVM `to` instead. Fee gas-refund can shift the transfer amount
  // away from `feeCoin.amount`, so we can't trust amount-based filtering either.
  const transferRecords = isEvmMessage
    ? []
    : (txResponse?.events || [])
        .filter((event) => event.type === 'transfer')
        .map((event) => {
          const attrs = event.attributes || [];
          const get = (key) => attrs.find((attr) => attr.key === key)?.value || '';
          return { recipient: get('recipient'), sender: get('sender'), amount: get('amount') };
        })
        .filter((record) => record.recipient.startsWith(CHAIN_CONFIG.bech32Prefix));

  const isFeeAmount = (rawAmount) => {
    if (!feeCoin || !rawAmount) return false;
    const parsed = buildAmountParts(rawAmount);
    return !!(parsed && parsed.amount === feeCoin.amount && parsed.denom === feeCoin.denom);
  };

  const nonFeeRecipient = transferRecords.find((record) => !isFeeAmount(record.amount));

  const cosmosTo =
    message.to_address ||
    message.recipient ||
    nonFeeRecipient?.recipient ||
    '';

  const evmHash =
    typeof message?.hash === 'string'
      ? message.hash.toLowerCase()
      : getEventAttributes(txResponse?.events, 'ethereum_tx', 'ethereumTxHash')[0] || null;

  const evmFrom =
    message?.from ||
    getEventAttributes(txResponse?.events, 'message', 'sender').find((value) =>
      value.startsWith('0x')
    ) ||
    '';
  const evmTo =
    message?.data?.to ||
    getEventAttributes(txResponse?.events, 'ethereum_tx', 'recipient').find((value) =>
      value.startsWith('0x')
    ) ||
    '';
  const evmCalldata = normalizeEvmCalldata(message?.data?.data) || '0x';
  const evmValue = normalizeNumericString(message?.data?.value, '0');

  // For EVM-wrapped txs, native value transfers happen inside the EVM module and don't emit a
  // second cosmos `transfer` event. Convert the EVM `to` to bech32 so the cosmos-style display
  // (block detail "Included Transactions") shows the actual recipient instead of the fee_collector.
  const evmToBech32 = evmTo ? toBech32Address(evmTo) : '';
  const resolvedEvmFromAddress = evmFrom || toHexAddress(cosmosFrom) || '';

  const lep100 = decodeLep100Transfer(message);
  const nftCall = !lep100 ? decodeNftCall(message) : null;

  let resolvedToAddress = cosmosTo || evmToBech32 || evmTo || '';
  let resolvedEvmToAddress = evmTo || '';
  let resolvedAmount = transferAmount?.amount || '0';
  let resolvedDenom = transferAmount?.denom || CHAIN_CONFIG.baseDenom;
  let resolvedAmountDisplay = transferAmount ? formatCoin(transferAmount) : '--';
  let resolvedMethod = normalizeMessageType(message?.['@type']);
  let resolvedTxType = normalizeTxType(message);
  let tokenContractAddress = null;

  if (lep100) {
    tokenContractAddress = evmTo;
    resolvedToAddress = lep100.recipient;
    resolvedEvmToAddress = lep100.recipient;
    resolvedAmount = lep100.amount;
    resolvedDenom = lep100.token.symbol;
    resolvedAmountDisplay = `${formatTokenAmount(lep100.amount, lep100.token.decimals ?? 18)} ${lep100.token.symbol}`;
    resolvedMethod = 'Transfer';
    resolvedTxType = 'transfer';
  } else if (nftCall) {
    tokenContractAddress = evmTo;
    resolvedToAddress = nftCall.recipient;
    resolvedEvmToAddress = nftCall.recipient;
    resolvedAmount = '1';
    resolvedDenom = nftCall.token.symbol;
    resolvedAmountDisplay = `${nftCall.token.symbol} #${nftCall.tokenId}`;
    resolvedMethod = nftCall.method;
    resolvedTxType = nftCall.method.toLowerCase();
  } else if (
    isEvmMessage &&
    evmTo &&
    isPositiveIntegerString(evmValue) &&
    (!evmCalldata || evmCalldata === '0x')
  ) {
    resolvedToAddress = evmToBech32 || evmTo;
    resolvedEvmToAddress = evmTo;
    resolvedAmount = evmValue;
    resolvedDenom = CHAIN_CONFIG.baseDenom;
    resolvedAmountDisplay = formatCoin({
      amount: evmValue,
      denom: CHAIN_CONFIG.baseDenom
    });
    resolvedMethod = 'Transfer';
    resolvedTxType = 'transfer';
  }

  return {
    hash: normalizeTxHash(txResponse?.txhash || ''),
    evmHash: evmHash ? evmHash.toLowerCase() : null,
    blockHeight: Number(txResponse?.height || 0),
    timestamp: txResponse?.timestamp || '',
    fromAddress: cosmosFrom || evmFrom || '',
    toAddress: resolvedToAddress,
    cosmosFromAddress: cosmosFrom || '',
    cosmosToAddress: cosmosTo || '',
    evmFromAddress: resolvedEvmFromAddress,
    evmToAddress: resolvedEvmToAddress,
    tokenContractAddress,
    tokenSymbol: lep100?.token.symbol || null,
    amount: resolvedAmount,
    denom: resolvedDenom,
    amountDisplay: resolvedAmountDisplay,
    feeAmount: feeCoin?.amount || '0',
    feeDenom: feeCoin?.denom || CHAIN_CONFIG.baseDenom,
    feeDisplay: feeCoin ? formatFeeCoin(feeCoin) : '--',
    gasUsed: Number(txResponse?.gas_used || 0),
    gasWanted: Number(txResponse?.gas_wanted || 0),
    success: Number(txResponse?.code || 0) === 0,
    status: Number(txResponse?.code || 0) === 0 ? 'Success' : 'Failed',
    method: resolvedMethod,
    txType: resolvedTxType,
    memo: tx?.body?.memo || '',
    rawLog: txResponse?.raw_log || '',
    inputData: evmCalldata,
    source: 'COSMOS',
    txResponse
  };
};

const sortTransactionsDescending = (left, right) => {
  if (right.blockHeight !== left.blockHeight) {
    return right.blockHeight - left.blockHeight;
  }

  return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
};

const mapIndexedTransactionRecord = (record = {}) => {
  const amount = normalizeNumericString(
    record.tokenTransferAmount ?? record.value ?? record.amount,
    '0'
  );
  const denom = record.denom || CHAIN_CONFIG.baseDenom;
  const feeAmount = normalizeNumericString(record.feePaid ?? record.feeAmount, '0');
  const evmHash = record.evmHash || record.evm_hash || null;
  const hash = normalizeTxHash(record.hash || record.txHash || '');
  const success = record.success !== false;

  return {
    hash,
    evmHash: evmHash ? String(evmHash).toLowerCase() : null,
    blockHeight: Number(record.blockHeight ?? record.block_height ?? 0),
    timestamp: record.timestamp || '',
    fromAddress: record.fromAddr || record.fromAddress || record.cosmosFromAddr || '',
    toAddress: record.toAddr || record.toAddress || record.cosmosToAddr || '',
    cosmosFromAddress: record.cosmosFromAddr || record.fromAddr || '',
    cosmosToAddress: record.cosmosToAddr || record.toAddr || '',
    evmFromAddress: record.evmFromAddr || record.evmFromAddress || '',
    evmToAddress: record.evmToAddr || record.evmToAddress || '',
    tokenContractAddress: record.tokenContractAddress || null,
    tokenSymbol: record.tokenSymbol || null,
    amount,
    denom,
    amountDisplay: isPositiveIntegerString(amount)
      ? formatCoin({ amount, denom })
      : '0 LITHO',
    feeAmount,
    feeDenom: CHAIN_CONFIG.baseDenom,
    feeDisplay: isPositiveIntegerString(feeAmount)
      ? formatFeeCoin({ amount: feeAmount, denom: CHAIN_CONFIG.baseDenom })
      : '0 Strat',
    gasUsed: Number(record.gasUsed ?? record.gas_used ?? 0),
    gasWanted: Number(record.gasWanted ?? record.gas_wanted ?? 0),
    success,
    status: success ? 'Success' : 'Failed',
    method: record.method || 'Transaction',
    txType: record.txType || record.tx_type || 'transaction',
    memo: record.memo || '',
    rawLog: record.rawLog || record.raw_log || '',
    inputData: record.inputData || record.input_data || '0x',
    source: 'INDEXED',
    txResponse: null
  };
};

const fetchIndexedTransactionsPage = async ({ page = 1, pageSize = PAGE_SIZE } = {}) =>
  withCache(`indexed-txs:${page}:${pageSize}`, TTL_MEDIUM, async () => {
    const offset = Math.max(0, (page - 1) * pageSize);
    const payload = await readExplorerApi(`/txs?limit=${pageSize}&offset=${offset}`);

    if (!payload || !Array.isArray(payload.txs)) {
      return null;
    }

    const total = Number(payload.total ?? payload.txs.length);
    const items = payload.txs
      .map(mapIndexedTransactionRecord)
      .filter((item) => item.hash)
      .sort(sortTransactionsDescending);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestHeight: items[0]?.blockHeight || 0,
      items,
      source: 'indexed'
    };
  }, { staleWhileRevalidate: true });

const fetchSummaryTransactionWindow = async () => {
  const [indexed, summary] = await Promise.all([
    fetchIndexedTransactionsPage({ page: 1, pageSize: 8 }),
    fetchExplorerSummaryApi().catch(() => null)
  ]);

  // Return indexed transactions immediately when available — the homepage
  // summary doesn't need ultra-fresh live-scanned data, and the live scan
  // (20K blocks) takes 5-10s when there's no recent activity (0-TXS blocks).
  // Live overlay is only fetched when indexed returns nothing at all.
  if (indexed?.items?.length) {
    const indexedFeedStale = isIndexedTransactionFeedStale(summary);
    return {
      latestHeight: indexed.latestHeight,
      total: indexed.total,
      items: indexed.items,
      source: indexedFeedStale ? 'indexed-stale' : 'indexed'
    };
  }

  // Indexed empty (brand-new chain or indexer not started): try live scan
  const live = await fetchLiveTransactionWindow({ limit: 8 });
  return live.items.length ? live : (indexed ?? EMPTY_TX_WINDOW);
};

const fetchLiveTransactionWindow = async ({
  lookbackBlocks = RECENT_LOOKBACK_BLOCKS,
  limit = 100
} = {}) =>
  withCache(`live-transaction-window:${lookbackBlocks}:${limit}`, TTL_REALTIME, async () => {
    const latestHeight = await fetchLatestHeight();
    const records = await fetchRecentTransactions({
      limit,
      initialScanWindow: Math.min(lookbackBlocks, RECENT_TRANSACTION_SCAN_INITIAL_BLOCKS),
      maxScanWindow: lookbackBlocks || RECENT_TRANSACTION_SCAN_MAX_BLOCKS,
      batchSize: RECENT_TRANSACTION_SCAN_BATCH_SIZE
    });
    const mapped = records
      .map((record) => {
        const txResponse = record.txResponse || record.tx_response || record;
        return mapLiveTransaction({ tx: txResponse?.tx, tx_response: txResponse });
      })
      .filter((item) => item.hash)
      .sort(sortTransactionsDescending);

    return {
      latestHeight,
      total: mapped.length,
      items: mapped,
      source: 'live'
    };
  }, { staleWhileRevalidate: true });

const fetchStatusSnapshot = async () =>
  withCache('status-snapshot', TTL_REALTIME, async () => {
    try {
      const { data } = await http.get(CHAIN_CONFIG.statusApiUrl);
      return data?.kamet || data?.makalu || data?.network || data || null;
    } catch {
      return null;
    }
  });

const fetchStatusMetricsSnapshot = async () =>
  withCache('status-metrics-snapshot', TTL_REALTIME, async () => {
    if (!CHAIN_CONFIG.statusMetricsUrl) {
      return null;
    }

    try {
      const { data } = await http.get(CHAIN_CONFIG.statusMetricsUrl);
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  });

const normalizeStatusSeverity = (severity = '', status = '') => {
  if (String(status || '').toLowerCase() === 'resolved') {
    return 'resolved';
  }

  return String(severity || '').trim().toLowerCase() || 'info';
};

const pickStatusText = (...values) =>
  values
    .flat()
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';

const normalizeStatusTargets = (...values) => [
  ...new Set(
    values
      .flatMap((value) => {
        if (Array.isArray(value)) {
          return value;
        }

        if (typeof value === 'string') {
          return value.split(',').map((entry) => entry.trim());
        }

        return [];
      })
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )
];

const normalizeStatusLink = (payload = {}) =>
  pickStatusText(
    payload.url,
    payload.link,
    payload.details_url,
    payload.detailsUrl,
    payload.incident_url,
    payload.incidentUrl,
    payload.maintenance_url,
    payload.maintenanceUrl
  );

const normalizeStatusTitle = (payload = {}, fallback = '') =>
  pickStatusText(
    payload.title,
    payload.summary,
    payload.name,
    payload.component,
    payload.service,
    payload.type,
    fallback
  );

const normalizeStatusComponent = (payload = {}) =>
  pickStatusText(payload.component, payload.service, payload.category, payload.subsystem);

const normalizeStatusSource = (payload = {}) =>
  pickStatusText(payload.source, payload.monitor, payload.check, payload.origin);

const normalizeStatusEvent = (event = {}) => ({
  type: event.type || 'status_event',
  title: normalizeStatusTitle(event, 'Status event'),
  severity: normalizeStatusSeverity(event.severity, event.status),
  message: pickStatusText(
    event.message,
    event.statusMessage,
    event.summary,
    event.description,
    'Status event'
  ),
  details: pickStatusText(event.details, event.description, event.reason, event.resolution),
  network: event.network || '',
  node: event.node || event.displayName || '',
  component: normalizeStatusComponent(event),
  source: normalizeStatusSource(event),
  status: event.status || '',
  incidentKey: event.incident_key || event.incidentKey || '',
  timestamp: event.timestamp || event.last_event_at || event.started_at || '',
  createdAt: event.created_at || event.createdAt || event.started_at || event.startedAt || '',
  updatedAt: event.updated_at || event.updatedAt || event.last_event_at || event.lastEventAt || '',
  acknowledgedAt: event.acknowledged_at || event.acknowledgedAt || '',
  resolvedAt: event.resolved_at || event.resolvedAt || '',
  impact: pickStatusText(event.impact, event.impact_summary, event.impactSummary),
  rootCause: pickStatusText(event.root_cause, event.rootCause, event.cause),
  resolution: pickStatusText(event.resolution, event.recovery, event.mitigation),
  postmortemUrl: pickStatusText(event.postmortem_url, event.postmortemUrl, event.rca_url, event.rcaUrl),
  tags: normalizeStatusTargets(event.tags, event.labels, event.regions, event.scopes),
  timeline: normalizeStatusNestedUpdates(event.updates, event.timeline, event.history),
  externalUrl: normalizeStatusLink(event),
  affectedTargets: normalizeStatusTargets(
    event.affected_endpoints,
    event.affectedEndpoints,
    event.targets,
    event.endpoints,
    event.components
  )
});

const normalizeStatusIncident = (incident = {}) => ({
  type: incident.type || 'incident',
  title: normalizeStatusTitle(incident, 'Incident'),
  severity: normalizeStatusSeverity(incident.severity, incident.status),
  message: pickStatusText(
    incident.message,
    incident.statusMessage,
    incident.summary,
    incident.description,
    'Active incident'
  ),
  details: pickStatusText(incident.details, incident.description, incident.reason, incident.resolution),
  network: incident.network || '',
  node: incident.node || incident.displayName || '',
  component: normalizeStatusComponent(incident),
  source: normalizeStatusSource(incident),
  status: incident.status || 'active',
  incidentKey: incident.incident_key || incident.incidentKey || '',
  startedAt: incident.started_at || incident.startedAt || incident.timestamp || '',
  lastEventAt: incident.last_event_at || incident.lastEventAt || incident.timestamp || '',
  resolvedAt: incident.resolved_at || incident.resolvedAt || '',
  updatedAt: incident.updated_at || incident.updatedAt || incident.last_event_at || incident.lastEventAt || '',
  impact: pickStatusText(incident.impact, incident.impact_summary, incident.impactSummary),
  rootCause: pickStatusText(incident.root_cause, incident.rootCause, incident.cause),
  resolution: pickStatusText(incident.resolution, incident.recovery, incident.mitigation),
  postmortemUrl: pickStatusText(
    incident.postmortem_url,
    incident.postmortemUrl,
    incident.rca_url,
    incident.rcaUrl
  ),
  tags: normalizeStatusTargets(incident.tags, incident.labels, incident.regions, incident.scopes),
  timeline: normalizeStatusNestedUpdates(incident.updates, incident.timeline, incident.history),
  externalUrl: normalizeStatusLink(incident),
  affectedTargets: normalizeStatusTargets(
    incident.affected_endpoints,
    incident.affectedEndpoints,
    incident.targets,
    incident.endpoints,
    incident.components
  ),
  durationMs: Number(incident.duration_ms ?? incident.durationMs ?? 0)
});

const normalizeStatusMaintenance = (maintenance = {}) => ({
  type: maintenance.type || 'maintenance',
  title: normalizeStatusTitle(maintenance, 'Scheduled maintenance'),
  severity: normalizeStatusSeverity(maintenance.severity, maintenance.status || 'maintenance'),
  message: pickStatusText(
    maintenance.message,
    maintenance.statusMessage,
    maintenance.summary,
    maintenance.description,
    'Scheduled maintenance window'
  ),
  details: pickStatusText(
    maintenance.details,
    maintenance.description,
    maintenance.reason,
    maintenance.resolution,
    maintenance.impact
  ),
  network: maintenance.network || '',
  node: maintenance.node || maintenance.displayName || '',
  component: normalizeStatusComponent(maintenance),
  source: normalizeStatusSource(maintenance),
  status: maintenance.status || 'scheduled',
  incidentKey:
    maintenance.maintenance_key || maintenance.maintenanceKey || maintenance.incident_key || maintenance.incidentKey || '',
  startedAt: pickStatusText(
    maintenance.scheduled_for,
    maintenance.scheduledFor,
    maintenance.window_start,
    maintenance.windowStart,
    maintenance.start_at,
    maintenance.startAt,
    maintenance.timestamp
  ),
  endsAt: pickStatusText(
    maintenance.window_end,
    maintenance.windowEnd,
    maintenance.end_at,
    maintenance.endAt,
    maintenance.completed_at,
    maintenance.completedAt
  ),
  updatedAt: maintenance.updated_at || maintenance.updatedAt || '',
  createdAt: maintenance.created_at || maintenance.createdAt || '',
  acknowledgedAt: maintenance.acknowledged_at || maintenance.acknowledgedAt || '',
  resolvedAt: maintenance.resolved_at || maintenance.resolvedAt || '',
  impact: pickStatusText(maintenance.impact, maintenance.impact_summary, maintenance.impactSummary),
  rootCause: pickStatusText(maintenance.root_cause, maintenance.rootCause, maintenance.cause),
  resolution: pickStatusText(maintenance.resolution, maintenance.recovery, maintenance.mitigation),
  postmortemUrl: pickStatusText(
    maintenance.postmortem_url,
    maintenance.postmortemUrl,
    maintenance.rca_url,
    maintenance.rcaUrl
  ),
  tags: normalizeStatusTargets(
    maintenance.tags,
    maintenance.labels,
    maintenance.regions,
    maintenance.scopes
  ),
  timeline: normalizeStatusNestedUpdates(maintenance.updates, maintenance.timeline, maintenance.history),
  externalUrl: normalizeStatusLink(maintenance),
  affectedTargets: normalizeStatusTargets(
    maintenance.affected_endpoints,
    maintenance.affectedEndpoints,
    maintenance.targets,
    maintenance.endpoints,
    maintenance.components
  ),
  durationMs: Number(
    maintenance.duration_ms ??
      maintenance.durationMs ??
      maintenance.estimated_duration_ms ??
      maintenance.estimatedDurationMs ??
      0
  )
});

const pickStatusArray = (...values) => values.find(Array.isArray) || [];

const normalizeStatusNestedUpdate = (update = {}, fallbackType = 'update') => ({
  type: update.type || fallbackType,
  title: normalizeStatusTitle(update, 'Update'),
  severity: normalizeStatusSeverity(update.severity, update.status),
  status: update.status || '',
  message: pickStatusText(
    update.message,
    update.statusMessage,
    update.summary,
    update.description,
    update.note
  ),
  details: pickStatusText(update.details, update.description, update.note, update.reason, update.resolution),
  component: normalizeStatusComponent(update),
  source: normalizeStatusSource(update),
  timestamp: normalizeStatusTimestamp(
    update.timestamp,
    update.created_at,
    update.createdAt,
    update.updated_at,
    update.updatedAt
  ),
  author: pickStatusText(update.author, update.author_name, update.authorName, update.actor),
  externalUrl: normalizeStatusLink(update)
});

const normalizeStatusNestedUpdates = (...values) =>
  pickStatusArray(...values)
    .map((update, index) => normalizeStatusNestedUpdate(update, `update_${index + 1}`))
    .filter((update) => update.message || update.details || update.title);

const pickStatusValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim()));

const normalizeStatusMetricNumber = (...values) => {
  const value = pickStatusValue(...values);
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeStatusPercentage = (...values) => {
  const numeric = normalizeStatusMetricNumber(...values);

  if (numeric === null) {
    return null;
  }

  return numeric <= 1 ? numeric * 100 : numeric;
};

const buildMonitorSummary = ({
  statusSnapshot,
  statusMetrics,
  nodes,
  componentStatuses,
  activeAlerts,
  recentEvents,
  incidentHistory,
  scheduledMaintenance
}) => {
  const explicitSummary =
    pickStatusValue(
      statusMetrics?.monitor_summary,
      statusMetrics?.monitorSummary,
      statusMetrics?.summary,
      statusMetrics?.status_summary,
      statusMetrics?.statusSummary,
      statusMetrics?.counts,
      statusSnapshot?.monitor_summary,
      statusSnapshot?.monitorSummary,
      statusSnapshot?.summary,
      statusSnapshot?.status_summary,
      statusSnapshot?.statusSummary,
      statusSnapshot?.counts
    ) || {};

  const normalizedSummary = explicitSummary && typeof explicitSummary === 'object' ? explicitSummary : {};
  const componentCount = normalizeStatusMetricNumber(
    normalizedSummary.component_count,
    normalizedSummary.componentCount,
    normalizedSummary.service_count,
    normalizedSummary.serviceCount,
    normalizedSummary.monitored_services,
    normalizedSummary.monitoredServices
  );
  const operationalComponentCount = normalizeStatusMetricNumber(
    normalizedSummary.operational_components,
    normalizedSummary.operationalComponents,
    normalizedSummary.healthy_components,
    normalizedSummary.healthyComponents
  );
  const degradedComponentCount = normalizeStatusMetricNumber(
    normalizedSummary.degraded_components,
    normalizedSummary.degradedComponents,
    normalizedSummary.warning_components,
    normalizedSummary.warningComponents
  );
  const unavailableComponentCount = normalizeStatusMetricNumber(
    normalizedSummary.unavailable_components,
    normalizedSummary.unavailableComponents,
    normalizedSummary.failed_components,
    normalizedSummary.failedComponents,
    normalizedSummary.down_components,
    normalizedSummary.downComponents
  );
  const availabilityPercent = normalizeStatusPercentage(
    normalizedSummary.availability_pct,
    normalizedSummary.availabilityPercent,
    normalizedSummary.uptime_pct,
    normalizedSummary.uptimePercent,
    normalizedSummary.slo_pct,
    normalizedSummary.sloPercent
  );

  return {
    onlineNodes:
      normalizeStatusMetricNumber(
        normalizedSummary.online_nodes,
        normalizedSummary.onlineNodes,
        statusSnapshot?.onlineNodes
      ) ||
      nodes.filter((node) => String(node.syncStatus || '').toLowerCase() === 'synced').length,
    totalNodes:
      normalizeStatusMetricNumber(
        normalizedSummary.total_nodes,
        normalizedSummary.totalNodes,
        statusSnapshot?.totalNodes
      ) || nodes.length,
    componentCount: componentCount ?? componentStatuses.length,
    operationalComponentCount:
      operationalComponentCount ??
      componentStatuses.filter((component) =>
        ['operational', 'success'].includes(String(component.status || '').toLowerCase())
      ).length,
    degradedComponentCount:
      degradedComponentCount ??
      componentStatuses.filter((component) =>
        ['degraded', 'warning', 'maintenance', 'investigating', 'scheduled'].includes(
          String(component.status || '').toLowerCase()
        )
      ).length,
    unavailableComponentCount:
      unavailableComponentCount ??
      componentStatuses.filter((component) =>
        ['failed', 'unavailable', 'down', 'critical', 'outage'].includes(
          String(component.status || '').toLowerCase()
        )
      ).length,
    incidentHistoryCount:
      normalizeStatusMetricNumber(
        normalizedSummary.incident_history_count,
        normalizedSummary.incidentHistoryCount,
        normalizedSummary.resolved_incident_count,
        normalizedSummary.resolvedIncidentCount
      ) ?? incidentHistory.length,
    activeAlertCount:
      normalizeStatusMetricNumber(
        normalizedSummary.active_alert_count,
        normalizedSummary.activeAlertCount,
        statusMetrics?.active_alert_count,
        statusMetrics?.activeAlertCount
      ) ?? activeAlerts.length,
    recentEventCount:
      normalizeStatusMetricNumber(
        normalizedSummary.recent_event_count,
        normalizedSummary.recentEventCount,
        statusMetrics?.recent_event_count,
        statusMetrics?.recentEventCount
      ) ?? recentEvents.length,
    maintenanceCount:
      normalizeStatusMetricNumber(
        normalizedSummary.maintenance_count,
        normalizedSummary.maintenanceCount,
        normalizedSummary.scheduled_maintenance_count,
        normalizedSummary.scheduledMaintenanceCount,
        normalizedSummary.upcoming_maintenance_count,
        normalizedSummary.upcomingMaintenanceCount
      ) ?? scheduledMaintenance.length,
    availabilityPercent,
    metricsLastUpdated: pickStatusText(
      normalizedSummary.updated_at,
      normalizedSummary.updatedAt,
      statusMetrics?.timestamp,
      statusSnapshot?.lastUpdated
    )
  };
};

const normalizeStatusTimestamp = (...values) => pickStatusText(...values);

const normalizeStatusNetwork = (payload = {}) => pickStatusText(payload.network, payload.networkId, payload.chain, payload.chainId);

const normalizeComponentStatusRecord = (component = {}, fallbackKey = '') => {
  const statusLabel = pickStatusText(
    component.status_label,
    component.statusLabel,
    component.status,
    component.state,
    component.health,
    component.level,
    component.severity,
    'unknown'
  );
  const title = normalizeStatusTitle(component, 'Component');
  const status = String(statusLabel || 'unknown').trim().toLowerCase() || 'unknown';

  return {
    key: String(component.key || component.id || title || fallbackKey || 'component').trim(),
    title,
    component: normalizeStatusComponent(component) || title,
    kind: pickStatusText(component.kind, component.probe, component.type, component.category, component.subsystem),
    status,
    statusLabel,
    message: pickStatusText(
      component.message,
      component.statusMessage,
      component.summary,
      component.description,
      component.reason
    ),
    details: pickStatusText(component.details, component.description, component.reason, component.resolution),
    source: normalizeStatusSource(component),
    network: normalizeStatusNetwork(component),
    latencyMs: normalizeStatusMetricNumber(component.latency_ms, component.latencyMs, component.latency),
    uptimePercent: normalizeStatusPercentage(
      component.uptime_pct,
      component.uptimePercent,
      component.availability_pct,
      component.availabilityPercent,
      component.uptime,
      component.availability
    ),
    lastChecked: normalizeStatusTimestamp(
      component.last_checked,
      component.lastChecked,
      component.updated_at,
      component.updatedAt,
      component.timestamp,
      component.created_at,
      component.createdAt
    ),
    externalUrl: normalizeStatusLink(component),
    affectedTargets: normalizeStatusTargets(
      component.affected_endpoints,
      component.affectedEndpoints,
      component.targets,
      component.endpoints,
      component.components
    )
  };
};

const normalizeNodeComponentStatus = (node = {}, fallbackKey = '') => {
  const syncStatus = String(node.syncStatus || '').trim().toLowerCase();
  const status =
    syncStatus === 'synced'
      ? 'operational'
      : syncStatus === 'catching_up' || syncStatus === 'syncing'
        ? 'degraded'
        : syncStatus || 'unknown';

  return normalizeComponentStatusRecord(
    {
      key: node.key || fallbackKey,
      title: node.displayName || node.label || node.endpoint || `Endpoint ${fallbackKey}`,
      component: node.probe || node.kind || 'endpoint',
      kind: node.kind || 'node',
      status,
      message: node.endpoint ? `Public ${node.probe || node.kind || 'endpoint'} probe` : '',
      details: node.endpoint || '',
      source: 'status monitor',
      latency_ms: node.latency,
      last_checked: node.lastChecked,
      affected_endpoints: [node.endpoint].filter(Boolean)
    },
    fallbackKey
  );
};

const buildDerivedComponentStatuses = ({
  statusSnapshot,
  latestBlock,
  explorerSummary,
  indexingLag
}) => {
  const lastChecked = pickStatusText(
    statusSnapshot?.lastUpdated,
    explorerSummary?.latestBlockTimestamp,
    latestBlock?.header?.time
  );
  const derived = [];
  const nodes = Array.isArray(statusSnapshot?.nodes) ? statusSnapshot.nodes : [];

  nodes.forEach((node, index) => {
    derived.push(normalizeNodeComponentStatus(node, `node-${index + 1}`));
  });

  derived.push(
    normalizeComponentStatusRecord(
      {
        key: 'status-api',
        title: 'Public Status API',
        component: 'status',
        kind: 'api',
        status: statusSnapshot ? 'operational' : 'unavailable',
        message: statusSnapshot
          ? 'The public status monitor is reachable.'
          : 'The public status monitor did not return data for this refresh.',
        source: 'derived',
        last_checked: lastChecked,
        affected_endpoints: [CHAIN_CONFIG.statusApiUrl]
      },
      'status-api'
    )
  );

  derived.push(
    normalizeComponentStatusRecord(
      {
        key: 'rest-api',
        title: 'REST API',
        component: 'rest',
        kind: 'api',
        status: latestBlock?.header?.height ? 'operational' : 'unavailable',
        message: latestBlock?.header?.height
          ? 'The public REST API returned the latest block successfully.'
          : 'The public REST API did not return the latest block during this refresh.',
        source: 'derived',
        last_checked: latestBlock?.header?.time || lastChecked,
        affected_endpoints: [CHAIN_CONFIG.restUrl]
      },
      'rest-api'
    )
  );

  derived.push(
    normalizeComponentStatusRecord(
      {
        key: 'indexer',
        title: 'Explorer Indexer',
        component: 'indexer',
        kind: 'indexer',
        status: indexingLag > 0 || explorerSummary?.staleData ? 'degraded' : 'operational',
        message:
          indexingLag > 0 || explorerSummary?.staleData
            ? 'Indexed explorer data is behind the latest chain height.'
            : 'Indexed explorer data is current.',
        details: normalizeStatusMessage(explorerSummary, !explorerSummary),
        source: 'derived',
        last_checked: explorerSummary?.latestBlockTimestamp || lastChecked,
        affected_endpoints: [CHAIN_CONFIG.explorerDataApiUrl].filter(Boolean)
      },
      'indexer'
    )
  );

  return derived;
};

const mergeStatusRecords = (primary = [], secondary = []) => {
  const merged = new Map();

  [...secondary, ...primary].forEach((record, index) => {
    if (!record) {
      return;
    }

    const key = String(record.key || `${record.title || 'record'}-${index}`).trim().toLowerCase();
    const current = merged.get(key) || {};
    merged.set(key, {
      ...current,
      ...record,
      affectedTargets: normalizeStatusTargets(current.affectedTargets, record.affectedTargets)
    });
  });

  return Array.from(merged.values());
};

const sortStatusRecords = (records = [], timestampPaths = []) => {
  const priorityMap = new Map([
    ['critical', 0],
    ['failed', 0],
    ['outage', 0],
    ['down', 0],
    ['unavailable', 1],
    ['degraded', 2],
    ['warning', 2],
    ['investigating', 2],
    ['maintenance', 2],
    ['scheduled', 3],
    ['planned', 3],
    ['info', 3],
    ['operational', 4],
    ['success', 4],
    ['resolved', 5],
    ['neutral', 6],
    ['unknown', 7]
  ]);

  const resolveTimestamp = (record) =>
    timestampPaths
      .map((path) => Date.parse(String(record?.[path] || '')))
      .find((value) => Number.isFinite(value) && value > 0) || 0;

  return [...records].sort((left, right) => {
    const leftPriority = priorityMap.get(String(left.status || left.severity || '').toLowerCase()) ?? 5;
    const rightPriority = priorityMap.get(String(right.status || right.severity || '').toLowerCase()) ?? 5;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const rightTimestamp = resolveTimestamp(right);
    const leftTimestamp = resolveTimestamp(left);

    if (rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return String(left.title || left.component || '').localeCompare(String(right.title || right.component || ''));
  });
};

const fetchValidatorAugmentedList = async () =>
  withCache('validators-augmented', TTL_MEDIUM, async () => {
    const [validators, signingInfoResponse, slashingParamsResponse] = await Promise.all([
      fetchAllValidators(),
      http.get(CosmosAPI.signingInfos()).catch(() => ({ data: {} })),
      http.get(CosmosAPI.slashingParams()).catch(() => ({ data: {} }))
    ]);

    const signingInfos = signingInfoResponse?.data?.signing_infos || signingInfoResponse?.data?.info || [];
    const signedBlocksWindow = Number(
      slashingParamsResponse?.data?.params?.signed_blocks_window ||
        slashingParamsResponse?.data?.params?.signedBlocksWindow ||
        0
    );

    const signingInfoByAddress = new Map(
      signingInfos.map((item) => [String(item.address || '').toLowerCase(), item])
    );

    const derivedValidators = await Promise.all(
      validators.map(async (validator) => {
        const consensusKey = validator?.consensus_pubkey?.key || validator?.consensusPubkey?.key || '';
        const consensusMeta = await digestConsensusPubkey(consensusKey);
        const signingInfo = signingInfoByAddress.get(consensusMeta.consensusAddress.toLowerCase()) || null;
        const missedBlocks = Number(signingInfo?.missed_blocks_counter || 0);
        const uptime =
          signedBlocksWindow > 0
            ? Math.max(0, ((signedBlocksWindow - missedBlocks) / signedBlocksWindow) * 100)
            : 100;

        return {
          ...validator,
          proposerHex: consensusMeta.proposerHex,
          consensusAddress: consensusMeta.consensusAddress,
          missedBlocks,
          uptime,
          statusLabel: getValidatorDisplayStatus(validator),
          moniker: getValidatorDisplayName(validator)
        };
      })
    );

    return sortValidators(derivedValidators);
  });

const buildValidatorProposerIndex = async () => {
  const validators = await fetchValidatorAugmentedList();
  return new Map(validators.map((validator) => [validator.proposerHex, validator]));
};

const sumGasFromResults = (results = {}) => {
  const txResults = Array.isArray(results?.txs_results) ? results.txs_results : [];
  const gasUsed = txResults.reduce((sum, txResult) => sum + Number(txResult?.gas_used || 0), 0);
  const gasLimit = txResults.reduce((sum, txResult) => sum + Number(txResult?.gas_wanted || 0), 0);

  return { gasUsed, gasLimit };
};

const mapBlockPayload = async (payload, blockResults = null, proposerIndex = null) => {
  const rpcBlock = payload?.result?.block || payload?.block || null;
  const blockId = payload?.result?.block_id || payload?.block_id || null;

  if (!rpcBlock?.header) {
    return null;
  }

  const proposerHex = String(rpcBlock.header.proposer_address || '').toUpperCase();
  const proposer = proposerIndex?.get(proposerHex) || null;
  const { gasUsed, gasLimit } = sumGasFromResults(blockResults?.result || blockResults || {});
  const txCount = Array.isArray(rpcBlock?.data?.txs)
    ? rpcBlock.data.txs.length
    : Number(payload?.num_txs || payload?.result?.num_txs || 0);

  return {
    height: Number(rpcBlock.header.height || 0),
    hash: blockId?.hash || '',
    parentHash: rpcBlock.header.last_block_id?.hash || '',
    timestamp: rpcBlock.header.time || '',
    txCount,
    proposerAddress: proposer?.operator_address || proposer?.operatorAddress || '',
    proposerMoniker: proposer?.moniker || '',
    proposerConsensusHex: proposerHex,
    gasUsed,
    gasLimit,
    size: new Blob([JSON.stringify(rpcBlock)]).size,
    status: 'Committed',
    exactTime: rpcBlock.header.time || '',
    relativeTime: formatRelativeTime(rpcBlock.header.time || ''),
    block: rpcBlock
  };
};

const fetchBlockPayloadByHash = async (hash) => {
  const { data } = await http.get(CosmosAPI.blockByHash(hash));
  return data;
};

const fetchBlockPayloadByHeight = async (height) => {
  const { data } = await http.get(CosmosAPI.blockByHeight(height));
  return data;
};

const fetchBlockResultsByHeight = async (height) => {
  const { data } = await http.get(CosmosAPI.blockResults(height));
  return data;
};

const mapBlockMetaToListItem = (meta, proposerIndex = null) => {
  const header = meta?.header;
  if (!header) {
    return null;
  }

  const proposerHex = String(header.proposer_address || '').toUpperCase();
  const proposer = proposerIndex?.get(proposerHex) || null;
  const blockId = meta.block_id || {};
  const txCount = Number(meta.num_txs ?? header.num_txs ?? 0);
  const blockSize = Number(meta.block_size || 0);
  const time = header.time || '';

  return {
    height: Number(header.height || 0),
    hash: blockId.hash || '',
    parentHash: header.last_block_id?.hash || '',
    timestamp: time,
    txCount,
    proposerAddress: proposer?.operator_address || proposer?.operatorAddress || '',
    proposerMoniker: proposer?.moniker || '',
    proposerConsensusHex: proposerHex,
    gasUsed: undefined,
    gasLimit: undefined,
    size: blockSize,
    status: 'Committed',
    exactTime: time,
    relativeTime: formatRelativeTime(time),
    block: null
  };
};

const fetchBlocksForPage = async (page = 1, pageSize = PAGE_SIZE) =>
  withCache(`blocks:${page}:${pageSize}`, TTL_REALTIME, async () => {
    const latestHeight = await fetchLatestHeight();
    const maxHeight = Math.max(1, latestHeight - (page - 1) * pageSize);
    const minHeight = Math.max(1, maxHeight - pageSize + 1);
    const [blockMetas, proposerIndex] = await Promise.all([
      fetchBlockMetas(minHeight, maxHeight),
      buildValidatorProposerIndex()
    ]);

    const items = [...blockMetas]
      .sort((left, right) => Number(right?.header?.height || 0) - Number(left?.header?.height || 0))
      .map((meta) => mapBlockMetaToListItem(meta, proposerIndex))
      .filter(Boolean);

    return {
      page,
      pageSize,
      latestHeight,
      total: latestHeight,
      totalPages: Math.ceil(latestHeight / pageSize),
      items
    };
  }, { staleWhileRevalidate: true });

const normalizeStatusMessage = (summary, liveFallback = false) => {
  if (summary?.statusMessage) {
    return summary.statusMessage;
  }

  if (liveFallback) {
    return 'Indexed API unavailable. Showing live chain data from public Kamet endpoints.';
  }

  return 'Explorer data is live.';
};

const fetchExplorerSummaryApi = async () =>
  withCache('explorer-summary-api', TTL_LONG, async () => {
    const summary = await readExplorerApi('/stats/summary');
    return summary && typeof summary === 'object' ? summary : null;
  }, { staleWhileRevalidate: true });

const detectTokenContract = async (address) => {
  const normalizedAddress = toChecksumAddress(address);

  if (!normalizedAddress) {
    return null;
  }

  const knownToken = getKnownToken(normalizedAddress);
  if (knownToken) {
    return knownToken;
  }

  const contract = new ethers.Contract(normalizedAddress, ERC20_ABI, publicProvider);

  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply()
    ]);

    return {
      address: normalizedAddress,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
      type: 'fungible',
      verified: false,
      abi: ERC20_ABI
    };
  } catch {
    const nftContract = new ethers.Contract(normalizedAddress, ERC721_ABI, publicProvider);
    const [name, symbol, totalSupply, isErc721] = await Promise.allSettled([
      nftContract.name(),
      nftContract.symbol(),
      nftContract.totalSupply(),
      nftContract.supportsInterface(ERC721_INTERFACE_ID)
    ]);

    if (isErc721.status === 'fulfilled' && isErc721.value) {
      return {
        address: normalizedAddress,
        contractAddress: normalizedAddress,
        name: name.status === 'fulfilled' ? name.value : 'NFT Collection',
        symbol: symbol.status === 'fulfilled' ? symbol.value : 'NFT',
        decimals: 0,
        totalSupply: totalSupply.status === 'fulfilled' ? totalSupply.value.toString() : '',
        type: 'nft',
        standard: 'lep100-6',
        verified: false,
        abi: ERC721_ABI
      };
    }

    return null;
  }
};

const fetchContractStatusApi = async (address) => {
  try {
    const { data } = await http.get(CosmosAPI.contractStatus(address));
    return data;
  } catch (error) {
    if (error?.response?.status === 501 || error?.response?.status === 404) {
      return null;
    }

    return null;
  }
};

const fetchContractSourceApi = async (address) => {
  try {
    const { data } = await http.get(CosmosAPI.contractSource(address));
    return data;
  } catch (error) {
    if (error?.response?.status === 501 || error?.response?.status === 404) {
      return null;
    }

    return null;
  }
};

const fetchRecentLogs = async (address, fromBlock, toBlock = 'latest', topics) => {
  try {
    return await publicProvider.getLogs({
      address,
      fromBlock,
      toBlock,
      topics
    });
  } catch {
    return [];
  }
};

const padTopicAddress = (address) => ethers.utils.hexZeroPad(toChecksumAddress(address), 32);

const isNftTokenType = (token = {}) =>
  ['nft', 'erc721', 'erc1155', 'lep100-6'].includes(
    String(token?.type || token?.standard || '').toLowerCase()
  );

const resolveTokenLedgerStartBlock = (token) => {
  const configuredBlock = Number(token?.deploymentBlock || token?.startBlock || token?.fromBlock || 0);
  return Number.isFinite(configuredBlock) && configuredBlock > 0 ? configuredBlock : 0;
};

const fetchLogsAcrossRange = async (address, fromBlock, toBlock, topics) => {
  const normalizedFrom = Math.max(0, Number(fromBlock) || 0);
  const normalizedTo =
    typeof toBlock === 'number' && Number.isFinite(toBlock)
      ? toBlock
      : await publicProvider.getBlockNumber().catch(() => normalizedFrom);
  const logs = [];

  for (let start = normalizedFrom; start <= normalizedTo; start += TOKEN_LEDGER_CHUNK_SIZE) {
    const end = Math.min(normalizedTo, start + TOKEN_LEDGER_CHUNK_SIZE - 1);
    const chunk = await fetchRecentLogs(address, start, end, topics);

    if (chunk.length) {
      logs.push(...chunk);
    }
  }

  return logs.sort((left, right) => {
    if ((left.blockNumber || 0) !== (right.blockNumber || 0)) {
      return (left.blockNumber || 0) - (right.blockNumber || 0);
    }

    return (left.logIndex || 0) - (right.logIndex || 0);
  });
};

const getTokenLedgerCacheKey = (token = {}) =>
  `${String(token.contractAddress || token.address || '').toLowerCase()}:${String(token.type || '').toLowerCase()}`;

const normalizeTokenTransferEntries = (token, log) => {
  const topic = log?.topics?.[0];

  if (topic === TRANSFER_EVENT_TOPIC) {
    try {
      const parsed = ERC20_TRANSFER_INTERFACE.parseLog(log);
      const value = parsed.args.value.toString();

      return [
        {
          standard: isNftTokenType(token) ? 'lep100-6' : 'lep100',
          txHash: log.transactionHash,
          blockHeight: log.blockNumber,
          logIndex: log.logIndex,
          fromAddress: parsed.args.from || '',
          toAddress: parsed.args.to || '',
          amount: isNftTokenType(token) ? '1' : value,
          tokenId: isNftTokenType(token) ? value : '',
          quantity: isNftTokenType(token) ? '1' : value
        }
      ];
    } catch {
      return [];
    }
  }

  if (topic === TRANSFER_SINGLE_TOPIC) {
    try {
      const parsed = ERC1155_INTERFACE.parseLog(log);
      return [
        {
          standard: 'erc1155',
          txHash: log.transactionHash,
          blockHeight: log.blockNumber,
          logIndex: log.logIndex,
          fromAddress: parsed.args.from || '',
          toAddress: parsed.args.to || '',
          amount: parsed.args.value.toString(),
          tokenId: parsed.args.id.toString(),
          quantity: parsed.args.value.toString()
        }
      ];
    } catch {
      return [];
    }
  }

  if (topic === TRANSFER_BATCH_TOPIC) {
    try {
      const parsed = ERC1155_INTERFACE.parseLog(log);
      return parsed.args.ids.map((id, index) => ({
        standard: 'erc1155',
        txHash: log.transactionHash,
        blockHeight: log.blockNumber,
        logIndex: Number(log.logIndex || 0) + index / 1000,
        fromAddress: parsed.args.from || '',
        toAddress: parsed.args.to || '',
        amount: parsed.args.values[index].toString(),
        tokenId: id.toString(),
        quantity: parsed.args.values[index].toString()
      }));
    } catch {
      return [];
    }
  }

  return [];
};

const fetchTokenTransferHistory = async (token, { fullHistory = false, lookbackBlocks = RECENT_LOOKBACK_BLOCKS } = {}) =>
  withCache(
    `token-transfer-history:${getTokenLedgerCacheKey(token)}:${fullHistory ? 'full' : `lookback-${lookbackBlocks}`}`,
    fullHistory ? TTL_LONG : TTL_SHORT,
    async () => {
      const contractAddress = toChecksumAddress(token?.contractAddress || token?.address || '');

      if (!contractAddress) {
        return [];
      }

      const latestBlockNumber = await publicProvider.getBlockNumber().catch(() => 0);
      const fromBlock = fullHistory
        ? resolveTokenLedgerStartBlock(token)
        : Math.max(0, latestBlockNumber - lookbackBlocks);
      const topicSets = isNftTokenType(token)
        ? [[TRANSFER_EVENT_TOPIC], [TRANSFER_SINGLE_TOPIC], [TRANSFER_BATCH_TOPIC]]
        : [[TRANSFER_EVENT_TOPIC]];

      const allLogs = await Promise.all(
        topicSets.map((topics) => fetchLogsAcrossRange(contractAddress, fromBlock, latestBlockNumber, topics))
      );

      return allLogs
        .flat()
        .flatMap((log) => normalizeTokenTransferEntries(token, log))
        .sort((left, right) => {
          if ((left.blockHeight || 0) !== (right.blockHeight || 0)) {
            return (left.blockHeight || 0) - (right.blockHeight || 0);
          }

          return Number(left.logIndex || 0) - Number(right.logIndex || 0);
        });
    }
  );

const fetchBlockTimestamp = async (blockNumber) =>
  withCache(`block-timestamp:${blockNumber}`, TTL_LONG, async () => {
    if (!Number.isFinite(Number(blockNumber)) || Number(blockNumber) <= 0) {
      return '';
    }

    const block = await publicProvider.getBlock(Number(blockNumber)).catch(() => null);
    return block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : '';
  });

const fetchBlockTimestampMap = async (blockNumbers = []) => {
  const uniqueBlockNumbers = [...new Set(blockNumbers.filter((value) => Number.isFinite(Number(value)) && Number(value) > 0).map(Number))];
  const timestampEntries = await Promise.all(
    uniqueBlockNumbers.map(async (blockNumber) => [blockNumber, await fetchBlockTimestamp(blockNumber)])
  );

  return new Map(timestampEntries);
};

const normalizeAddressKey = (address = '') =>
  String(toChecksumAddress(address) || address || '')
    .trim()
    .toLowerCase();

const createOwnershipState = (address = '') => ({
  address,
  balance: 0n,
  transfers: 0,
  sentCount: 0,
  receivedCount: 0,
  lastBlockHeight: 0,
  lastTxHash: '',
  tokenIds: new Map()
});

const updateOwnershipState = (state, { direction, blockHeight, txHash, amount = 0n }) => {
  state.transfers += 1;

  if (direction === 'in') {
    state.receivedCount += 1;
    state.balance += amount;
  } else if (direction === 'out') {
    state.sentCount += 1;
    state.balance -= amount;
  }

  if ((blockHeight || 0) >= state.lastBlockHeight) {
    state.lastBlockHeight = blockHeight || 0;
    state.lastTxHash = txHash || state.lastTxHash;
  }
};

const buildFungibleOwnershipSnapshot = async (token, transfers = [], decimals = CHAIN_CONFIG.decimals) => {
  const states = new Map();
  let lastTransferBlock = 0;

  for (const transfer of transfers) {
    const amount = BigInt(transfer.amount || '0');
    const fromAddress = toChecksumAddress(transfer.fromAddress);
    const toAddress = toChecksumAddress(transfer.toAddress);
    lastTransferBlock = Math.max(lastTransferBlock, Number(transfer.blockHeight || 0));

    if (fromAddress && fromAddress.toLowerCase() !== ZERO_ADDRESS) {
      const key = normalizeAddressKey(fromAddress);
      const current = states.get(key) || createOwnershipState(fromAddress);
      updateOwnershipState(current, {
        direction: 'out',
        blockHeight: transfer.blockHeight,
        txHash: transfer.txHash,
        amount
      });
      states.set(key, current);
    }

    if (toAddress && toAddress.toLowerCase() !== ZERO_ADDRESS) {
      const key = normalizeAddressKey(toAddress);
      const current = states.get(key) || createOwnershipState(toAddress);
      updateOwnershipState(current, {
        direction: 'in',
        blockHeight: transfer.blockHeight,
        txHash: transfer.txHash,
        amount
      });
      states.set(key, current);
    }
  }

  const positiveStates = [...states.values()].filter((state) => state.balance > 0n);
  const timestampMap = await fetchBlockTimestampMap(positiveStates.map((state) => state.lastBlockHeight).concat(lastTransferBlock));
  const holders = positiveStates
    .map((state) => ({
      address: state.address,
      balance: state.balance.toString(),
      balanceDisplay: formatTokenAmount(state.balance.toString(), decimals),
      transfers: state.transfers,
      sentCount: state.sentCount,
      receivedCount: state.receivedCount,
      lastSeen: timestampMap.get(state.lastBlockHeight) || '',
      lastBlockHeight: state.lastBlockHeight,
      lastTxHash: state.lastTxHash
    }))
    .sort((left, right) => {
      const leftBalance = BigInt(left.balance || '0');
      const rightBalance = BigInt(right.balance || '0');

      if (rightBalance !== leftBalance) {
        return rightBalance > leftBalance ? 1 : -1;
      }

      return right.transfers - left.transfers;
    });
  const addressStates = new Map(
    [...states.values()].map((state) => [
      normalizeAddressKey(state.address),
      {
        address: state.address,
        balance: state.balance > 0n ? state.balance.toString() : '0',
        balanceDisplay: state.balance > 0n ? formatTokenAmount(state.balance.toString(), decimals) : '',
        transfers: state.transfers,
        sentCount: state.sentCount,
        receivedCount: state.receivedCount,
        lastBlockHeight: state.lastBlockHeight,
        lastSeen: state.lastBlockHeight ? timestampMap.get(state.lastBlockHeight) || '' : '',
        lastTxHash: state.lastTxHash
      }
    ])
  );

  return {
    kind: 'fungible',
    holders,
    holderCount: holders.length,
    transferCount: transfers.length,
    lastTransferAt: timestampMap.get(lastTransferBlock) || '',
    addressStates,
    inventoryByAddress: new Map()
  };
};

const buildNftOwnershipSnapshot = async (token, transfers = []) => {
  const states = new Map();
  const tokenOwners = new Map();
  let lastTransferBlock = 0;

  const getState = (address) => {
    const key = normalizeAddressKey(address);
    const current = states.get(key) || createOwnershipState(address);
    states.set(key, current);
    return current;
  };

  for (const transfer of transfers) {
    const quantity = BigInt(transfer.quantity || '0');
    const tokenId = String(transfer.tokenId || '').trim();
    const fromAddress = toChecksumAddress(transfer.fromAddress);
    const toAddress = toChecksumAddress(transfer.toAddress);
    lastTransferBlock = Math.max(lastTransferBlock, Number(transfer.blockHeight || 0));

    if (!tokenId) {
      continue;
    }

    if (fromAddress && fromAddress.toLowerCase() !== ZERO_ADDRESS) {
      const state = getState(fromAddress);
      updateOwnershipState(state, {
        direction: 'out',
        blockHeight: transfer.blockHeight,
        txHash: transfer.txHash,
        amount: quantity
      });
      const currentQuantity = state.tokenIds.get(tokenId) || 0n;
      const nextQuantity = currentQuantity - quantity;

      if (nextQuantity > 0n) {
        state.tokenIds.set(tokenId, nextQuantity);
      } else {
        state.tokenIds.delete(tokenId);
      }
    }

    if (toAddress && toAddress.toLowerCase() !== ZERO_ADDRESS) {
      const state = getState(toAddress);
      updateOwnershipState(state, {
        direction: 'in',
        blockHeight: transfer.blockHeight,
        txHash: transfer.txHash,
        amount: quantity
      });
      const currentQuantity = state.tokenIds.get(tokenId) || 0n;
      state.tokenIds.set(tokenId, currentQuantity + quantity);
      tokenOwners.set(tokenId, {
        owner: toAddress,
        quantity: currentQuantity + quantity,
        lastBlockHeight: transfer.blockHeight || 0,
        lastTxHash: transfer.txHash || ''
      });
    } else {
      tokenOwners.delete(tokenId);
    }
  }

  const lastTransferTimestampMap = await fetchBlockTimestampMap(
    [...states.values()].map((state) => state.lastBlockHeight).concat(lastTransferBlock)
  );
  const holders = [...states.values()]
    .filter((state) => state.balance > 0n || [...state.tokenIds.values()].some((value) => value > 0n))
    .map((state) => ({
      address: state.address,
      balance: state.balance > 0n ? state.balance.toString() : String(state.tokenIds.size),
      balanceDisplay:
        state.balance > 0n
          ? `${state.balance.toString()} item${state.balance === 1n ? '' : 's'}`
          : `${state.tokenIds.size} item${state.tokenIds.size === 1 ? '' : 's'}`,
      transfers: state.transfers,
      sentCount: state.sentCount,
      receivedCount: state.receivedCount,
      tokenIds: [...state.tokenIds.entries()].map(([tokenId, quantity]) => ({
        tokenId,
        quantity: quantity.toString()
      })),
      lastSeen: lastTransferTimestampMap.get(state.lastBlockHeight) || '',
      lastBlockHeight: state.lastBlockHeight,
      lastTxHash: state.lastTxHash
    }))
    .sort((left, right) => {
      const leftBalance = BigInt(left.balance || '0');
      const rightBalance = BigInt(right.balance || '0');

      if (rightBalance !== leftBalance) {
        return rightBalance > leftBalance ? 1 : -1;
      }

      return right.transfers - left.transfers;
    });
  const inventoryByAddress = new Map(
    holders.map((holder) => [
      normalizeAddressKey(holder.address),
      holder.tokenIds.map((entry) => ({
        contractAddress: token.contractAddress,
        symbol: token.symbol,
        name: token.name,
        type: token.type || 'NFT',
        kind: 'nft',
        verified: Boolean(token.verified),
        balance: entry.quantity,
        balanceDisplay: `Token #${entry.tokenId}${entry.quantity !== '1' ? ` x${entry.quantity}` : ''}`,
        tokenId: entry.tokenId,
        transferCount: holder.transfers,
        incomingTransfers: holder.receivedCount,
        outgoingTransfers: holder.sentCount,
        lastTransferAt: holder.lastSeen,
        route: normalizeActivityRoute(token.contractAddress, 'nft'),
        source: 'derived'
      }))
    ])
  );
  const addressStates = new Map(
    holders.map((holder) => [
      normalizeAddressKey(holder.address),
      {
        address: holder.address,
        balance: holder.balance,
        balanceDisplay: holder.balanceDisplay,
        transfers: holder.transfers,
        sentCount: holder.sentCount,
        receivedCount: holder.receivedCount,
        lastBlockHeight: holder.lastBlockHeight,
        lastSeen: holder.lastSeen,
        lastTxHash: holder.lastTxHash,
        tokenIds: holder.tokenIds
      }
    ])
  );

  return {
    kind: 'nft',
    holders,
    holderCount: holders.length,
    transferCount: transfers.length,
    lastTransferAt: lastTransferTimestampMap.get(lastTransferBlock) || '',
    addressStates,
    inventoryByAddress
  };
};

const fetchDerivedTokenOwnershipSnapshot = async (token) =>
  withCache(`derived-token-ownership:${getTokenLedgerCacheKey(token)}`, TTL_LONG, async () => {
    const contractAddress = toChecksumAddress(token?.contractAddress || token?.address || '');

    if (!contractAddress) {
      return null;
    }

    const transfers = await fetchTokenTransferHistory(
      {
        ...token,
        contractAddress
      },
      { fullHistory: true }
    );

    if (isNftTokenType(token)) {
      return buildNftOwnershipSnapshot(
        {
          ...token,
          contractAddress
        },
        transfers
      );
    }

    return buildFungibleOwnershipSnapshot(
      {
        ...token,
        contractAddress
      },
      transfers,
      token?.decimals ?? CHAIN_CONFIG.decimals
    );
  });

const fetchAddressTokenTransfers = async (address, lookbackBlocks = RECENT_LOOKBACK_BLOCKS) => {
  const evmAddress = toHexAddress(address);

  if (!evmAddress) {
    return [];
  }

  const activityTokens = (await fetchActivityEligibleTokenCatalog()).filter(
    (token) => !isNftTokenType(token)
  );
  if (!activityTokens.length) {
    return [];
  }

  const latestBlockNumber = await publicProvider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlockNumber - lookbackBlocks);
  const topicAddress = padTopicAddress(evmAddress);

  const transferLogs = await Promise.allSettled(
    activityTokens.flatMap((token) => [
      fetchRecentLogs(token.address, fromBlock, 'latest', [TRANSFER_EVENT_TOPIC, topicAddress]).then(
        (logs) =>
          logs.map((log) => ({
            ...log,
            direction: 'out',
            token
          }))
      ),
      fetchRecentLogs(token.address, fromBlock, 'latest', [TRANSFER_EVENT_TOPIC, null, topicAddress]).then(
        (logs) =>
          logs.map((log) => ({
            ...log,
            direction: 'in',
            token
          }))
      )
    ])
  );

  const flatLogs = transferLogs
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((left, right) => (right.blockNumber || 0) - (left.blockNumber || 0));

  const uniqueLogs = new Map();
  flatLogs.forEach((log) => {
    const key = `${log.transactionHash}:${log.logIndex}`;

    if (!uniqueLogs.has(key)) {
      uniqueLogs.set(key, log);
    }
  });

  const logs = Array.from(uniqueLogs.values()).slice(0, 50);
  const blocksByNumber = new Map();

  await Promise.all(
    [...new Set(logs.map((log) => log.blockNumber).filter(Boolean))].map(async (blockNumber) => {
      const block = await publicProvider.getBlock(blockNumber).catch(() => null);
      if (block) {
        blocksByNumber.set(blockNumber, block);
      }
    })
  );

  return logs.map((log) => {
    const parsed = ERC20_TRANSFER_INTERFACE.parseLog(log);
    const block = blocksByNumber.get(log.blockNumber);

    return {
      tokenAddress: log.address,
      tokenSymbol: log.token.symbol,
      tokenName: log.token.name,
      txHash: log.transactionHash,
      blockHeight: log.blockNumber,
      timestamp: block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : '',
      fromAddress: parsed.args.from,
      toAddress: parsed.args.to,
      amount: parsed.args.value.toString(),
      amountDisplay: formatTokenAmount(parsed.args.value.toString()),
      direction: log.direction
    };
  });
};

const fetchTokenMetadata = async (token) => {
  const address = toChecksumAddress(token.address || token.contractAddress || '');

  if (isNftTokenType(token)) {
    const contract = new ethers.Contract(address, token.abi || ERC721_ABI, publicProvider);
    const [name, symbol, totalSupply, contractUri] = await Promise.allSettled([
      contract.name(),
      contract.symbol(),
      contract.totalSupply(),
      callOptionalContractMethod(contract, 'contractURI', token.collectionMetadataUri || '')
    ]);
    const collectionMetadataUri =
      contractUri.status === 'fulfilled' ? String(contractUri.value || '') : token.collectionMetadataUri || '';
    const collectionMetadata =
      (await readMetadataDocument(collectionMetadataUri)) || token.collectionMetadata || null;

    return {
      ...token,
      address,
      contractAddress: address,
      name: name.status === 'fulfilled' ? name.value : token.name,
      symbol: symbol.status === 'fulfilled' ? symbol.value : token.symbol,
      decimals: 0,
      totalSupply: totalSupply.status === 'fulfilled' ? totalSupply.value.toString() : token.totalSupply || '',
      collectionMetadataUri,
      collectionMetadata,
      description:
        collectionMetadata?.description ||
        token.description ||
        '',
      image: normalizeMetadataImage(collectionMetadata?.image || token.image || '')
    };
  }

  const contract = new ethers.Contract(address, token.abi || ERC20_ABI, publicProvider);
  const [name, symbol, decimals, totalSupply] = await Promise.allSettled([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply()
  ]);

  return {
    ...token,
    address,
    contractAddress: address,
    name: name.status === 'fulfilled' ? name.value : token.name,
    symbol: symbol.status === 'fulfilled' ? symbol.value : token.symbol,
    decimals: decimals.status === 'fulfilled' ? Number(decimals.value) : 18,
    totalSupply: totalSupply.status === 'fulfilled' ? totalSupply.value.toString() : token.totalSupply || ''
  };
};

const fetchKnownTokenCatalog = async () =>
  withCache('known-token-catalog', TTL_LONG, async () => {
    const tokens = await Promise.all(KAMET_KNOWN_TOKENS.map((token) => fetchTokenMetadata(token)));
    return tokens;
  });

const fetchNftPreviewTokens = async (token, transferEvents = []) => {
  if (!isNftTokenType(token)) {
    return [];
  }

  const contractAddress = toChecksumAddress(token.contractAddress || token.address || '');
  if (!contractAddress) {
    return [];
  }

  const uniqueTokenIds = [];
  const seenTokenIds = new Set();

  for (const event of [...transferEvents].reverse()) {
    const tokenId = String(event?.tokenId || '').trim();

    if (!tokenId || seenTokenIds.has(tokenId)) {
      continue;
    }

    seenTokenIds.add(tokenId);
    uniqueTokenIds.push(tokenId);

    if (uniqueTokenIds.length >= 6) {
      break;
    }
  }

  if (!uniqueTokenIds.length) {
    return [];
  }

  const contract = new ethers.Contract(contractAddress, token.abi || ERC721_ABI, publicProvider);
  const tokenUriResults = await Promise.all(
    uniqueTokenIds.map(async (tokenId) => {
      try {
        return [tokenId, await contract.tokenURI(tokenId)];
      } catch {
        return [tokenId, ''];
      }
    })
  );

  const tokenUriMap = new Map(tokenUriResults);
  const previews = await Promise.all(
    uniqueTokenIds.map(async (tokenId) => {
    const tokenUri = String(tokenUriMap.get(tokenId) || '');
      const metadata = tokenUri ? await readMetadataDocument(tokenUri) : null;

      return {
        tokenId,
        tokenUri,
        metadata,
        image: normalizeMetadataImage(metadata?.image || ''),
        name: metadata?.name || `Token #${tokenId}`,
        description: metadata?.description || '',
        attributes: Array.isArray(metadata?.attributes) ? metadata.attributes : []
      };
    })
  );

  return previews;
};

const fetchActivityEligibleTokenCatalog = async () => {
  const [knownTokens, indexedTokens] = await Promise.all([
    fetchKnownTokenCatalog(),
    fetchIndexedTokenCatalog()
  ]);
  const tokenMap = new Map();

  [...knownTokens, ...indexedTokens].forEach((token) => {
    const contractAddress = toChecksumAddress(token.contractAddress || token.address || '');

    if (!contractAddress) {
      return;
    }

    const key = contractAddress.toLowerCase();
    const current = tokenMap.get(key);
    tokenMap.set(
      key,
      current
        ? mergeTokenCatalogRecord(current, {
            ...token,
            contractAddress,
            address: contractAddress
          })
        : {
            ...token,
            contractAddress,
            address: contractAddress
          }
    );
  });

  return [...tokenMap.values()];
};

const fetchUniqueWalletCount = async (transactionWindow) => {
  if (!Number.isFinite(transactionWindow?.total) || transactionWindow.total > 500) {
    return {
      walletCount: null,
      approximate: false
    };
  }

  const wallets = new Set();
  transactionWindow.items.forEach((transaction) => {
    [
      transaction.fromAddress,
      transaction.toAddress,
      transaction.cosmosFromAddress,
      transaction.cosmosToAddress,
      transaction.evmFromAddress,
      transaction.evmToAddress
    ]
      .filter(Boolean)
      .forEach((address) => wallets.add(normalizeAddress(address) || address));
  });

  return {
    walletCount: wallets.size,
    approximate: true
  };
};

const matchTransactionsForAddress = (transactions, address) => {
  const normalizedHex = toHexAddress(address);
  const normalizedBech32 = toBech32Address(address);

  return transactions.filter((transaction) => {
    return [
      transaction.fromAddress,
      transaction.toAddress,
      transaction.cosmosFromAddress,
      transaction.cosmosToAddress,
      transaction.evmFromAddress,
      transaction.evmToAddress
    ].some((candidate) =>
      candidate
        ? isSameAddress(candidate, address) ||
          (normalizedHex && isSameAddress(candidate, normalizedHex)) ||
          (normalizedBech32 && isSameAddress(candidate, normalizedBech32))
        : false
    );
  });
};

const getReadableFunctions = (interfaceInstance) =>
  interfaceInstance
    ? Object.values(interfaceInstance.functions).filter(
        (fragment) =>
          fragment.type === 'function' &&
          ['view', 'pure'].includes(fragment.stateMutability || '')
      )
    : [];

const getWritableFunctions = (interfaceInstance) =>
  interfaceInstance
    ? Object.values(interfaceInstance.functions).filter(
        (fragment) =>
          fragment.type === 'function' &&
          !['view', 'pure'].includes(fragment.stateMutability || '')
      )
    : [];

const parseKnownLog = (address, abi, log) => {
  if (!abi?.length) {
    return null;
  }

  try {
    const iface = buildContractInterface(abi);
    const parsed = iface.parseLog(log);

    return {
      address,
      name: parsed.name,
      signature: parsed.signature,
      values: Object.fromEntries(
        Object.entries(parsed.args || {})
          .filter(([key]) => Number.isNaN(Number(key)))
          .map(([key, value]) => [key, value?._isBigNumber ? value.toString() : String(value)])
      )
    };
  } catch {
    return null;
  }
};

// TTL cache for the recent-contract-events scan. The fetch fans out to
// eth_getLogs (chunked) + N eth_getBlockByNumber calls per unique block; cache
// here prevents successive tx-detail pages on the same contract from
// re-issuing the entire fan-out.
const CONTRACT_EVENTS_TTL_MS = 5 * 60 * 1000;
const contractEventsCache = new Map();

const fetchRecentContractEvents = async (address, abi = [], lookbackBlocks = RECENT_LOOKBACK_BLOCKS) => {
  const cacheKey = `${String(address || '').toLowerCase()}:${lookbackBlocks}`;
  const cached = contractEventsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONTRACT_EVENTS_TTL_MS) {
    return cached.events;
  }

  const latestBlockNumber = await publicProvider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlockNumber - lookbackBlocks);
  // Chunked fetch — fetchLogsAcrossRange splits into TOKEN_LEDGER_CHUNK_SIZE
  // (5000) block batches so each RPC stays under the 60s upstream timeout.
  const logs = await fetchLogsAcrossRange(address, fromBlock, latestBlockNumber);
  const recentLogs = logs.slice(-25).reverse();
  const blockNumbers = [...new Set(recentLogs.map((log) => log.blockNumber))];
  const blocksByNumber = new Map();

  // Cap getBlock concurrency to 3 — Promise.all on 25 blocks was hammering
  // a single backend and the AWS sentry's memiavl leak amplifies the
  // tail latency.
  const GETBLOCK_CONCURRENCY = 3;
  for (let i = 0; i < blockNumbers.length; i += GETBLOCK_CONCURRENCY) {
    const batch = blockNumbers.slice(i, i + GETBLOCK_CONCURRENCY);
    await Promise.all(
      batch.map(async (blockNumber) => {
        const block = await publicProvider.getBlock(blockNumber).catch(() => null);
        if (block) {
          blocksByNumber.set(blockNumber, block);
        }
      })
    );
  }

  const events = recentLogs.map((log) => ({
    txHash: log.transactionHash,
    blockHeight: log.blockNumber,
    timestamp: blocksByNumber.get(log.blockNumber)
      ? new Date(blocksByNumber.get(log.blockNumber).timestamp * 1000).toISOString()
      : '',
    parsed: parseKnownLog(address, abi, log),
    raw: {
      topics: log.topics,
      data: log.data
      }
    }));

  contractEventsCache.set(cacheKey, { events, timestamp: Date.now() });
  return events;
};

const buildObservedTokenHolders = (recentTransfers = []) => {
  const holders = new Map();

  recentTransfers.forEach((transfer) => {
    [
      [transfer.fromAddress, 'sentCount'],
      [transfer.toAddress, 'receivedCount']
    ].forEach(([address, directionKey]) => {
      const normalizedAddress = toChecksumAddress(address);

      if (!normalizedAddress || normalizedAddress.toLowerCase() === ZERO_ADDRESS) {
        return;
      }

      const existing = holders.get(normalizedAddress) || {
        address: normalizedAddress,
        transfers: 0,
        sentCount: 0,
        receivedCount: 0,
        lastSeen: '',
        lastTxHash: ''
      };

      existing.transfers += 1;
      existing[directionKey] += 1;

      if (
        transfer.timestamp &&
        (!existing.lastSeen ||
          new Date(transfer.timestamp).getTime() > new Date(existing.lastSeen).getTime())
      ) {
        existing.lastSeen = transfer.timestamp;
        existing.lastTxHash = transfer.txHash || '';
      }

      holders.set(normalizedAddress, existing);
    });
  });

  return [...holders.values()]
    .sort((left, right) => {
      if (right.transfers !== left.transfers) {
        return right.transfers - left.transfers;
      }

      return new Date(right.lastSeen || '').getTime() - new Date(left.lastSeen || '').getTime();
    })
    .slice(0, 10);
};

const decodeKnownInput = (address, inputData) => {
  if (!inputData || inputData === '0x') {
    return null;
  }

  const known = getKnownContract(address) || getKnownToken(address);
  const tokenCandidate = known || null;
  const abi = tokenCandidate?.abi || null;

  if (!abi?.length) {
    return null;
  }

  try {
    const iface = buildContractInterface(abi);
    const parsed = iface.parseTransaction({
      data: inputData
    });

    return {
      name: parsed.name,
      signature: parsed.signature,
      args: parsed.args
        ? Object.fromEntries(
            Object.entries(parsed.args)
              .filter(([key]) => Number.isNaN(Number(key)))
              .map(([key, value]) => [key, value?._isBigNumber ? value.toString() : String(value)])
          )
        : {}
    };
  } catch {
    return null;
  }
};

const mapAddressBalances = async (address) => {
  const hexAddress = toHexAddress(address);
  const bech32Address = detectAddressType(address) === 'COSMOS' ? normalizeAddress(address) : toBech32Address(address);

  const [restBalancesResponse, evmBalanceHex, accountResponse] = await Promise.all([
    bech32Address ? http.get(CosmosAPI.balance(bech32Address)).catch(() => ({ data: { balances: [] } })) : Promise.resolve({ data: { balances: [] } }),
    hexAddress ? postEvmRpc(EvmAPI.balanceAt(hexAddress)).catch(() => '0x0') : Promise.resolve('0x0'),
    bech32Address ? http.get(CosmosAPI.account(bech32Address)).catch(() => ({ data: { account: null } })) : Promise.resolve({ data: { account: null } })
  ]);

  const balances = Array.isArray(restBalancesResponse?.data?.balances)
    ? restBalancesResponse.data.balances
    : [];
  const nativeCoin =
    balances.find((balance) => balance.denom === CHAIN_CONFIG.baseDenom) || {
      denom: CHAIN_CONFIG.baseDenom,
      amount: hexToDecimalString(evmBalanceHex || '0x0')
    };

  return {
    hexAddress,
    bech32Address,
    account: accountResponse?.data?.account || null,
    balances,
    nativeBalance: nativeCoin.amount || '0',
    nativeBalanceDisplay: formatTokenAmount(nativeCoin.amount || '0')
  };
};

const fetchTokenBalancesForAddress = async (address) => {
  const hexAddress = toHexAddress(address);

  if (!hexAddress) {
    return [];
  }

  const tokens = (await fetchActivityEligibleTokenCatalog()).filter((token) => !isNftTokenType(token));
  const balances = await Promise.all(
    tokens.map(async (token) => {
      try {
        const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, publicProvider);
        const balance = await contract.balanceOf(hexAddress);

        if (balance.isZero()) {
          return null;
        }

        return {
          ...token,
          balance: balance.toString(),
          balanceDisplay: formatTokenAmount(balance.toString(), token.decimals)
        };
      } catch {
        return null;
      }
    })
  );

  return balances.filter(Boolean);
};

const INDEXED_ADDRESS_ROOT_PATHS = [
  'data',
  'account',
  'address',
  'result',
  'profile',
  'portfolio',
  ''
];
const INDEXED_ADDRESS_INTERNAL_TX_PATHS = [
  'internalTransactions',
  'internal_transactions',
  'internalTxs',
  'activity.internalTransactions',
  'activity.internal_transactions',
  'activity.internalTxs'
];
const INDEXED_ADDRESS_NFT_PATHS = [
  'nfts',
  'nftAssets',
  'nft_assets',
  'portfolio.nfts',
  'portfolio.nftAssets',
  'assets.nfts'
];
const INDEXED_ADDRESS_ASSET_PATHS = [
  'assets',
  'tokenBalances',
  'token_balances',
  'holdings',
  'portfolio.assets',
  'portfolio.tokenBalances'
];

const isRecordObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getNestedValue = (record, path = '') => {
  if (!path) {
    return record;
  }

  return String(path)
    .split('.')
    .reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), record);
};

const pickFirstPresentValue = (record, paths = [], { allowEmptyString = false } = {}) => {
  for (const path of paths) {
    const value = getNestedValue(record, path);

    if (value === undefined || value === null) {
      continue;
    }

    if (!allowEmptyString && typeof value === 'string' && !value.trim()) {
      continue;
    }

    return value;
  }

  return null;
};

const pickFirstArrayValue = (record, paths = []) => {
  for (const path of paths) {
    const value = getNestedValue(record, path);

    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
};

const hasArrayValue = (record, paths = []) => paths.some((path) => Array.isArray(getNestedValue(record, path)));

const normalizeNumericString = (value, fallback = '0') => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return fallback;
  }

  if (stringValue.startsWith('0x')) {
    return hexToDecimalString(stringValue);
  }

  return stringValue;
};

const isPositiveIntegerString = (value) => {
  try {
    return BigInt(normalizeNumericString(value, '0')) > 0n;
  } catch {
    return false;
  }
};

const hasPositiveBalance = (value) => {
  try {
    return BigInt(normalizeNumericString(value)) > 0n;
  } catch {
    return false;
  }
};

const normalizeActivityRoute = (contractAddress = '', kind = 'token') => {
  if (!contractAddress) {
    return '';
  }

  return kind === 'nft' ? `/contract/${contractAddress}` : `/token/${contractAddress}`;
};

const normalizeIndexedAddressRoot = (payload = null) => {
  if (!isRecordObject(payload)) {
    return null;
  }

  const candidates = INDEXED_ADDRESS_ROOT_PATHS
    .map((path) => getNestedValue(payload, path))
    .filter(isRecordObject);

  return (
    candidates.find(
      (candidate) =>
        hasArrayValue(candidate, INDEXED_ADDRESS_INTERNAL_TX_PATHS) ||
        hasArrayValue(candidate, INDEXED_ADDRESS_NFT_PATHS) ||
        hasArrayValue(candidate, INDEXED_ADDRESS_ASSET_PATHS)
    ) ||
    candidates[0] ||
    null
  );
};

const normalizeIndexedInternalTransaction = (record = {}) => {
  const hash = String(
    pickFirstPresentValue(record, ['hash', 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash']) || ''
  ).trim();
  const methodValue = String(
    pickFirstPresentValue(record, ['method', 'type', 'callType', 'call_type', 'action']) ||
      'Internal transfer'
  )
    .replace(/_/g, ' ')
    .trim();
  const statusValue = String(
    pickFirstPresentValue(record, ['status', 'state', 'result'], { allowEmptyString: true }) || ''
  )
    .replace(/_/g, ' ')
    .trim();
  const normalizedStatus = statusValue || 'Success';
  const success = /success|ok|completed|confirmed|resolved|executed/i.test(normalizedStatus) || !statusValue;
  const amount = normalizeNumericString(
    pickFirstPresentValue(record, ['amount', 'value', 'amount.value', 'value.amount'])
  );

  return {
    hash,
    method: methodValue || 'Internal transfer',
    fromAddress: String(
      pickFirstPresentValue(record, ['from', 'fromAddress', 'from_address', 'sender'], { allowEmptyString: true }) ||
        ''
    ).trim(),
    toAddress: String(
      pickFirstPresentValue(record, ['to', 'toAddress', 'to_address', 'recipient'], { allowEmptyString: true }) || ''
    ).trim(),
    amount,
    amountDisplay: hasPositiveBalance(amount) ? formatTokenAmount(amount) : '--',
    status: normalizedStatus,
    success,
    timestamp: String(
      pickFirstPresentValue(record, ['timestamp', 'time', 'createdAt', 'created_at', 'updatedAt', 'updated_at'], {
        allowEmptyString: true
      }) || ''
    ).trim()
  };
};

const normalizeIndexedAssetRecord = (record = {}) => {
  const rawAddress = pickFirstPresentValue(record, [
    'contractAddress',
    'contract_address',
    'tokenAddress',
    'token_address',
    'address',
    'contract.address',
    'token.address'
  ]);
  const contractAddress = toChecksumAddress(rawAddress) || '';
  const knownAsset = contractAddress
    ? getKnownToken(contractAddress) || getKnownContract(contractAddress)
    : null;
  const tokenIdValue = pickFirstPresentValue(record, [
    'tokenId',
    'token_id',
    'nft.tokenId',
    'nft.token_id',
    'assetId',
    'asset_id'
  ]);
  const tokenId = tokenIdValue === null || tokenIdValue === undefined ? '' : String(tokenIdValue).trim();
  const rawType = String(
    pickFirstPresentValue(record, ['type', 'assetType', 'asset_type', 'tokenType', 'token_type'], {
      allowEmptyString: true
    }) ||
      knownAsset?.type ||
      ''
  ).trim();
  const lowerType = rawType.toLowerCase();
  const kind =
    tokenId ||
    lowerType === 'nft' ||
    lowerType === 'erc721' ||
    lowerType === 'lep100-6' ||
    lowerType === 'erc1155'
      ? 'nft'
      : 'token';
  const balance = normalizeNumericString(
    pickFirstPresentValue(record, ['balance', 'amount', 'quantity', 'balance.amount', 'token.balance']),
    kind === 'nft' && tokenId ? '1' : '0'
  );
  const decimals = Number(
    pickFirstPresentValue(record, ['decimals', 'token.decimals', 'asset.decimals'], {
      allowEmptyString: true
    }) ?? knownAsset?.decimals ?? CHAIN_CONFIG.decimals
  );
  const verifiedValue = pickFirstPresentValue(
    record,
    ['verified', 'isVerified', 'verification.verified'],
    { allowEmptyString: true }
  );
  const name = String(
    pickFirstPresentValue(record, ['name', 'tokenName', 'token_name', 'collectionName', 'collection.name']) ||
      knownAsset?.name ||
      (kind === 'nft' ? 'NFT Asset' : 'Token')
  ).trim();
  const symbol = String(
    pickFirstPresentValue(record, ['symbol', 'tokenSymbol', 'token_symbol', 'collectionSymbol', 'collection.symbol']) ||
      knownAsset?.symbol ||
      (kind === 'nft' ? 'NFT' : 'TOKEN')
  ).trim();
  const transferCount = Number(
    pickFirstPresentValue(record, ['transferCount', 'transfer_count', 'activity.transferCount'], {
      allowEmptyString: true
    }) || 0
  );
  const lastTransferAt = String(
    pickFirstPresentValue(
      record,
      ['lastTransferAt', 'last_transfer_at', 'updatedAt', 'updated_at', 'timestamp'],
      { allowEmptyString: true }
    ) || ''
  ).trim();

  if (!contractAddress && !name && !symbol) {
    return null;
  }

  return {
    contractAddress,
    symbol: symbol || name || 'Asset',
    name: name || symbol || 'Asset',
    type: rawType || (kind === 'nft' ? 'NFT' : 'LEP100'),
    kind,
    verified: verifiedValue === null ? Boolean(knownAsset?.verified) : Boolean(verifiedValue),
    balance,
    balanceDisplay:
      kind === 'nft'
        ? tokenId
          ? `Token #${tokenId}`
          : hasPositiveBalance(balance)
            ? `${balance} item(s)`
            : 'Indexed NFT'
        : hasPositiveBalance(balance)
          ? formatTokenAmount(balance, Number.isFinite(decimals) ? decimals : CHAIN_CONFIG.decimals)
          : 'Observed activity',
    tokenId,
    transferCount,
    incomingTransfers: 0,
    outgoingTransfers: 0,
    lastTransferAt,
    route: normalizeActivityRoute(contractAddress, kind),
    source: 'indexed'
  };
};

const buildAddressAssetActivity = ({ tokenBalances = [], tokenTransfers = [], indexedAssets = [] }) => {
  const assetsByKey = new Map();

  const upsertAsset = (incoming) => {
    if (!incoming) {
      return;
    }

    const key =
      incoming.tokenId && incoming.contractAddress
        ? `${incoming.contractAddress.toLowerCase()}:${incoming.tokenId}`
        : (incoming.contractAddress || incoming.symbol || incoming.name || '').toLowerCase();

    if (!key) {
      return;
    }

    const existing = assetsByKey.get(key) || {
      contractAddress: '',
      symbol: '',
      name: '',
      type: '',
      kind: 'token',
      verified: false,
      balance: '0',
      balanceDisplay: '',
      tokenId: '',
      transferCount: 0,
      incomingTransfers: 0,
      outgoingTransfers: 0,
      lastTransferAt: '',
      route: '',
      source: ''
    };

    const existingTimestamp = existing.lastTransferAt ? Date.parse(existing.lastTransferAt) : 0;
    const incomingTimestamp = incoming.lastTransferAt ? Date.parse(incoming.lastTransferAt) : 0;

    assetsByKey.set(key, {
      contractAddress: incoming.contractAddress || existing.contractAddress,
      symbol: incoming.symbol || existing.symbol,
      name: incoming.name || existing.name,
      type: incoming.type || existing.type || (incoming.kind === 'nft' ? 'NFT' : 'LEP100'),
      kind: incoming.kind || existing.kind || 'token',
      verified: existing.verified || Boolean(incoming.verified),
      balance: hasPositiveBalance(incoming.balance) ? incoming.balance : existing.balance,
      balanceDisplay:
        (hasPositiveBalance(incoming.balance) || incoming.kind === 'nft') && incoming.balanceDisplay
          ? incoming.balanceDisplay
          : existing.balanceDisplay || incoming.balanceDisplay || '',
      tokenId: incoming.tokenId || existing.tokenId,
      transferCount:
        Math.max(Number(existing.transferCount || 0), Number(incoming.transferCount || 0)) +
        Number(incoming.incrementTransferCount || 0),
      incomingTransfers:
        Number(existing.incomingTransfers || 0) + Number(incoming.incomingTransfers || 0),
      outgoingTransfers:
        Number(existing.outgoingTransfers || 0) + Number(incoming.outgoingTransfers || 0),
      lastTransferAt:
        incomingTimestamp > existingTimestamp ? incoming.lastTransferAt : existing.lastTransferAt,
      route: incoming.route || existing.route,
      source: incoming.source || existing.source
    });
  };

  tokenBalances.forEach((token) =>
    upsertAsset({
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      name: token.name,
      type: token.type || 'LEP100',
      kind: String(token.type || '').toLowerCase() === 'nft' ? 'nft' : 'token',
      verified: Boolean(token.verified),
      balance: token.balance || '0',
      balanceDisplay: token.balanceDisplay,
      route: normalizeActivityRoute(token.contractAddress, 'token'),
      source: 'balance'
    })
  );

  tokenTransfers.forEach((transfer) => {
    const knownToken = getKnownToken(transfer.tokenAddress) || getKnownContract(transfer.tokenAddress);

    upsertAsset({
      contractAddress: toChecksumAddress(transfer.tokenAddress) || transfer.tokenAddress,
      symbol: transfer.tokenSymbol || knownToken?.symbol || 'Token',
      name: transfer.tokenName || knownToken?.name || 'Token',
      type: knownToken?.type || 'LEP100',
      kind: 'token',
      verified: Boolean(knownToken?.verified),
      transferCount: 0,
      incrementTransferCount: 1,
      incomingTransfers: transfer.direction === 'in' ? 1 : 0,
      outgoingTransfers: transfer.direction === 'out' ? 1 : 0,
      lastTransferAt: transfer.timestamp,
      route: normalizeActivityRoute(transfer.tokenAddress, 'token'),
      source: 'observed'
    });
  });

  indexedAssets.forEach((asset) => upsertAsset(asset));

  const assets = Array.from(assetsByKey.values())
    .map((asset) => ({
      ...asset,
      transferCount:
        asset.transferCount || Number(asset.incomingTransfers || 0) + Number(asset.outgoingTransfers || 0)
    }))
    .sort((left, right) => {
      const leftBalance = hasPositiveBalance(left.balance);
      const rightBalance = hasPositiveBalance(right.balance);

      if (leftBalance !== rightBalance) {
        return rightBalance - leftBalance;
      }

      if ((right.transferCount || 0) !== (left.transferCount || 0)) {
        return (right.transferCount || 0) - (left.transferCount || 0);
      }

      const rightTimestamp = right.lastTransferAt ? Date.parse(right.lastTransferAt) : 0;
      const leftTimestamp = left.lastTransferAt ? Date.parse(left.lastTransferAt) : 0;

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      return String(left.symbol || left.name).localeCompare(String(right.symbol || right.name));
    });

  return {
    assets,
    tokenAssets: assets.filter((asset) => asset.kind !== 'nft'),
    nftAssets: assets.filter((asset) => asset.kind === 'nft')
  };
};

const normalizeIndexedAddressProfile = (payload = null) => {
  const root = normalizeIndexedAddressRoot(payload);

  if (!root) {
    return null;
  }

  const supportsInternalTransactions = hasArrayValue(root, INDEXED_ADDRESS_INTERNAL_TX_PATHS);
  const supportsNftInventory = hasArrayValue(root, INDEXED_ADDRESS_NFT_PATHS);
  const supportsIndexedAssets = hasArrayValue(root, INDEXED_ADDRESS_ASSET_PATHS);
  const internalTransactions = (pickFirstArrayValue(root, INDEXED_ADDRESS_INTERNAL_TX_PATHS) || [])
    .map((record) => normalizeIndexedInternalTransaction(record))
    .filter((record) => record.hash || record.fromAddress || record.toAddress);
  const indexedAssets = (pickFirstArrayValue(root, INDEXED_ADDRESS_ASSET_PATHS) || [])
    .map((record) => normalizeIndexedAssetRecord(record))
    .filter(Boolean);
  const nftAssets = (pickFirstArrayValue(root, INDEXED_ADDRESS_NFT_PATHS) || [])
    .map((record) => normalizeIndexedAssetRecord(record))
    .filter(Boolean);

  if (!supportsInternalTransactions && !supportsNftInventory && !supportsIndexedAssets) {
    return null;
  }

  return {
    internalTransactions,
    supportsInternalTransactions,
    supportsNftInventory,
    indexedAssets,
    nftAssets
  };
};

const fetchIndexedAddressProfile = async (address) =>
  withCache(`indexed-address-profile:${normalizeAddress(address) || address}`, TTL_SHORT, async () => {
    if (!CHAIN_CONFIG.explorerDataApiUrl) {
      return null;
    }

    const candidateAddresses = [
      sanitizeSearchInput(address),
      toChecksumAddress(address),
      toHexAddress(address),
      toBech32Address(address)
    ]
      .filter(Boolean)
      .map((value) => String(value).trim());
    const uniqueAddresses = [...new Set(candidateAddresses)];
    const pathPrefixes = ['accounts', 'addresses'];

    for (const candidate of uniqueAddresses) {
      for (const prefix of pathPrefixes) {
        const payload = await readExplorerApi(`/${prefix}/${encodeURIComponent(candidate)}`);
        const normalized = normalizeIndexedAddressProfile(payload);

        if (normalized) {
          return normalized;
        }
      }
    }

    return null;
  });

const fetchDerivedAddressAssetProfile = async (address) => {
  const normalizedKey = normalizeAddressKey(toHexAddress(address) || address);

  if (!normalizedKey) {
    return {
      assets: [],
      nftInventorySupported: false
    };
  }

  const tokens = await fetchActivityEligibleTokenCatalog();
  const snapshots = await Promise.all(
    tokens.map(async (token) => [token, await fetchDerivedTokenOwnershipSnapshot(token).catch(() => null)])
  );
  const assets = [];
  let nftInventorySupported = false;

  snapshots.forEach(([token, snapshot]) => {
    if (!snapshot) {
      return;
    }

    if (isNftTokenType(token)) {
      nftInventorySupported = true;
      const inventory = snapshot.inventoryByAddress?.get(normalizedKey) || [];
      assets.push(...inventory);
      return;
    }

    const state = snapshot.addressStates?.get(normalizedKey);

    if (!state || (!hasPositiveBalance(state.balance) && !Number(state.transfers || 0))) {
      return;
    }

    assets.push({
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      name: token.name,
      type: token.type || 'LEP100',
      kind: 'token',
      verified: Boolean(token.verified),
      balance: state.balance || '0',
      balanceDisplay: state.balanceDisplay || '',
      transferCount: Number(state.transfers || 0),
      incomingTransfers: Number(state.receivedCount || 0),
      outgoingTransfers: Number(state.sentCount || 0),
      lastTransferAt: state.lastSeen || '',
      route: normalizeActivityRoute(token.contractAddress, 'token'),
      source: 'derived'
    });
  });

  return {
    assets,
    nftInventorySupported
  };
};

const normalizeTraceInternalTransaction = (record = {}, timestampMap = new Map()) => {
  const action = record.action || {};
  const blockHeight = Number(normalizeNumericString(record.blockNumber ?? record.block_height, '0'));
  const hash = String(record.transactionHash || record.transaction_hash || '').trim();
  const methodValue = String(record.type || action.callType || action.type || 'call')
    .replace(/_/g, ' ')
    .trim();
  const amount = normalizeNumericString(action.value ?? record.value, '0');
  const errorText = String(record.error || record.revertReason || '').trim();

  return {
    hash,
    method: methodValue || 'Internal transfer',
    fromAddress: String(action.from || record.from || '').trim(),
    toAddress: String(action.to || record.to || '').trim(),
    amount,
    amountDisplay: hasPositiveBalance(amount) ? formatTokenAmount(amount) : '--',
    status: errorText ? 'Failed' : 'Success',
    success: !errorText,
    timestamp: timestampMap.get(blockHeight) || '',
    blockHeight
  };
};

const fetchTraceInternalTransactions = async (address, lookbackBlocks = TRACE_LOOKBACK_BLOCKS) =>
  withCache(`trace-internal-transactions:${normalizeAddress(address) || address}:${lookbackBlocks}`, TTL_SHORT, async () => {
    const hexAddress = toHexAddress(address);

    if (!hexAddress) {
      return {
        supported: false,
        items: []
      };
    }

    try {
      const latestBlockNumber = await publicProvider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlockNumber - lookbackBlocks);
      const [outgoing, incoming] = await Promise.all([
        publicProvider.send('trace_filter', [
          {
            fromBlock: ethers.utils.hexValue(fromBlock),
            toBlock: ethers.utils.hexValue(latestBlockNumber),
            fromAddress: [hexAddress],
            after: 0,
            count: TRACE_RESULT_LIMIT
          }
        ]),
        publicProvider.send('trace_filter', [
          {
            fromBlock: ethers.utils.hexValue(fromBlock),
            toBlock: ethers.utils.hexValue(latestBlockNumber),
            toAddress: [hexAddress],
            after: 0,
            count: TRACE_RESULT_LIMIT
          }
        ])
      ]);
      const items = [...(Array.isArray(outgoing) ? outgoing : []), ...(Array.isArray(incoming) ? incoming : [])];
      const uniqueItems = new Map();

      items.forEach((item) => {
        const key = [
          item.transactionHash || item.transaction_hash || '',
          item.traceAddress ? JSON.stringify(item.traceAddress) : '',
          item.blockNumber || item.block_height || '',
          item.action?.from || item.from || '',
          item.action?.to || item.to || ''
        ].join(':');

        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        }
      });
      const timestampMap = await fetchBlockTimestampMap(
        [...uniqueItems.values()].map((item) =>
          Number(normalizeNumericString(item.blockNumber ?? item.block_height, '0'))
        )
      );

      return {
        supported: true,
        items: [...uniqueItems.values()]
          .map((item) => normalizeTraceInternalTransaction(item, timestampMap))
          .filter((item) => item.hash || item.fromAddress || item.toAddress)
          .sort((left, right) => {
            if ((right.blockHeight || 0) !== (left.blockHeight || 0)) {
              return (right.blockHeight || 0) - (left.blockHeight || 0);
            }

            return Date.parse(right.timestamp || '') - Date.parse(left.timestamp || '');
          })
      };
    } catch {
      return {
        supported: false,
        items: []
      };
    }
  });

const EMPTY_BLOCK_PAGE = { items: [], latestHeight: 0, total: 0, totalPages: 1, page: 1, pageSize: 6 };
const EMPTY_TX_WINDOW = { items: [], total: 0, latestHeight: 0 };
const INDEXED_TRANSACTION_STALE_LAG_BLOCKS = 1_000;
const INDEXED_TRANSACTION_STALE_AGE_MS = 15 * 60 * 1000;

const isIndexedTransactionFeedStale = (summary = null) => {
  if (!summary) {
    return false;
  }

  const tipHeight = Number(summary.tipHeight ?? 0);
  const chainTipHeight = Number(summary.chainTipHeight ?? 0);
  const syncLagBlocks = Number(summary.syncLagBlocks ?? Math.max(0, chainTipHeight - tipHeight));
  const latestTransactionTime = summary.latestTransactionTimestamp || summary.latestBlockTimestamp || '';
  const latestTransactionAgeMs = latestTransactionTime
    ? Date.now() - new Date(latestTransactionTime).getTime()
    : 0;

  return Boolean(
    summary.staleData ||
      summary.isSyncing ||
      syncLagBlocks > INDEXED_TRANSACTION_STALE_LAG_BLOCKS ||
      (chainTipHeight > 0 && tipHeight > 0 && chainTipHeight - tipHeight > INDEXED_TRANSACTION_STALE_LAG_BLOCKS) ||
      (latestTransactionAgeMs > INDEXED_TRANSACTION_STALE_AGE_MS)
  );
};

export const fetchExplorerSummary = async () =>
  withCache('explorer-summary-v1', TTL_SHORT, async () => {
    // Slow calls: fire in background, race against a deadline so fast live-RPC
    // data renders in ≤FAST_DEADLINE_MS. SWR populates the cache in the
    // background; the next render (≤TTL_SHORT) returns full data instantly.
    const FAST_DEADLINE_MS = 3_000;
    const deadline = (fallback) =>
      new Promise((resolve) => setTimeout(() => resolve(fallback), FAST_DEADLINE_MS));

    const summaryApiPromise  = fetchExplorerSummaryApi().catch(() => null);
    const txWindowPromise    = fetchSummaryTransactionWindow().catch(() => EMPTY_TX_WINDOW);
    const statusPromise      = fetchStatusSnapshot().catch(() => null);

    const [summaryApi, latestBlock, blockPage, transactionWindow, gasPriceHex, validators, statusSnapshot] =
      await Promise.all([
        Promise.race([summaryApiPromise,  deadline(null)]),
        fetchLatestBlock().catch(() => null),
        fetchBlocksForPage(1, 6).catch(() => EMPTY_BLOCK_PAGE),
        Promise.race([txWindowPromise,    deadline(EMPTY_TX_WINDOW)]),
        postEvmRpc(EvmAPI.gasPrice()).catch(() => '0x0'),
        fetchValidatorAugmentedList().catch(() => []),
        Promise.race([statusPromise,      deadline(null)])
      ]);

    // Keep background fetches alive — they populate SWR so the next render
    // returns full data without a fresh round-trip.
    summaryApiPromise.catch(() => {});
    txWindowPromise.catch(() => {});
    statusPromise.catch(() => {});

    const latestBlocks = blockPage.items;
    const averageBlockTime = latestBlocks.length > 1
      ? latestBlocks
          .slice(0, -1)
          .map((block, index) => {
            const current = new Date(block.timestamp).getTime();
            const next = new Date(latestBlocks[index + 1].timestamp).getTime();
            return (current - next) / 1000;
          })
          .filter((sample) => Number.isFinite(sample) && sample > 0)
          .reduce((sum, sample, _, source) => sum + sample / source.length, 0)
      : 0;
      const walletCountMeta = await fetchUniqueWalletCount(transactionWindow);
      const activeValidators = getPublicValidators(validators);
      const source = summaryApi ? 'indexed' : 'live';
      const tpsValue = Number(summaryApi?.tps ?? statusSnapshot?.tps);

      return {
        latestBlock: Number(latestBlock?.header?.height || blockPage.latestHeight || 0),
        latestBlockTime: latestBlock?.header?.time || latestBlocks[0]?.timestamp || '',
        averageBlockTime,
        averageBlockTimeLabel: formatDurationSeconds(averageBlockTime),
        tps: Number.isFinite(tpsValue) ? tpsValue : null,
        tpsLabel: Number.isFinite(tpsValue)
          ? tpsValue.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })
          : 'Indexing',
        gasPrice: gasPriceHex || '0x0',
        gasPriceLabel: formatGasPrice(gasPriceHex || '0x0', 'strat'),
        totalTransactions: summaryApi?.totalTransactions ?? transactionWindow.total,
      validatorCount: activeValidators.length,
      walletCount: summaryApi?.walletAddresses ?? walletCountMeta.walletCount,
      walletCountApproximate: summaryApi?.walletAddresses ? false : walletCountMeta.approximate,
      indexedThroughBlock:
        summaryApi?.tipHeight ??
        summaryApi?.chainTipHeight ??
        Number(latestBlock?.header?.height || blockPage.latestHeight || 0),
      lastUpdated:
        summaryApi?.latestBlockTimestamp ||
        statusSnapshot?.lastUpdated ||
        latestBlock?.header?.time ||
        '',
      staleData: Boolean(summaryApi?.staleData),
      source,
      statusMessage: normalizeStatusMessage(summaryApi, !summaryApi),
      transportHint: source === 'indexed' ? 'indexed-api' : 'live-rpc',
      topValidators: activeValidators.slice(0, 5),
      latestBlocks,
      latestTransactions: transactionWindow.items.slice(0, 6),
      statusSnapshot
    };
  }, { staleWhileRevalidate: true });

export const fetchBlocksPage = async ({ page = 1, pageSize = PAGE_SIZE, sortBy = 'height', sortDirection = 'desc' } = {}) => {
  const payload = await fetchBlocksForPage(page, pageSize);
  const direction = sortDirection === 'asc' ? 1 : -1;
  const items = [...payload.items].sort((left, right) => {
    if (sortBy === 'timestamp') {
      return (new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()) * direction;
    }

    if (sortBy === 'txCount') {
      return (left.txCount - right.txCount) * direction;
    }

    if (sortBy === 'gasUsed') {
      return (left.gasUsed - right.gasUsed) * direction;
    }

    return (left.height - right.height) * direction;
  });

  return {
    ...payload,
    items
  };
};

export const fetchBlockDetailById = async (heightOrHash) => {
  const identifier = sanitizeSearchInput(heightOrHash);
  const proposerIndex = await buildValidatorProposerIndex();

  let payload = null;

  if (looksLikeHeight(identifier)) {
    payload = await fetchBlockPayloadByHeight(identifier);
  } else if (looksLikeBlockHash(identifier)) {
    payload = await fetchBlockPayloadByHash(identifier);
  }

  if (!payload) {
    return null;
  }

  const block = payload?.result?.block || payload?.block;
  const height = Number(block?.header?.height || 0);
  const [blockResults, transactions] = await Promise.all([
    fetchBlockResultsByHeight(height).catch(() => null),
    fetchTransactionsForBlock(height, block?.data?.txs || [])
  ]);

  const mapped = await mapBlockPayload(payload, blockResults, proposerIndex);

  return {
    ...mapped,
    transactions: transactions.map((transaction) => {
      const live = mapLiveTransaction({
        tx: transaction.txResponse?.tx,
        tx_response: transaction.txResponse
      });

      return {
        ...live,
        hash: transaction.hash || live.hash,
        evmHash: transaction.evmHash || live.evmHash,
        blockHeight: transaction.blockHeight || live.blockHeight,
        timestamp: transaction.timestamp || live.timestamp,
        txResponse: transaction.txResponse
      };
    })
  };
};

export const fetchTransactionsPage = async ({
  page = 1,
  pageSize = PAGE_SIZE,
  sortBy = 'blockHeight',
  sortDirection = 'desc'
} = {}) => {
  const indexedPage = await fetchIndexedTransactionsPage({ page, pageSize });

  if (indexedPage) {
    // Return indexed data immediately when available. The live-overlay path
    // (20K-block scan) is skipped because when blocks have 0 TXS the scan
    // takes 5-10s and falls back to indexed data anyway.
    return indexedPage;
  }

  const transactionWindow = await fetchLiveTransactionWindow({ limit: Math.max(page * pageSize, pageSize) });
  const direction = sortDirection === 'asc' ? 1 : -1;
  const sorted = [...transactionWindow.items].sort((left, right) => {
    if (sortBy === 'age' || sortBy === 'timestamp') {
      return (new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()) * direction;
    }

    if (sortBy === 'amount') {
      return (BigInt(left.amount || '0') > BigInt(right.amount || '0') ? 1 : -1) * direction;
    }

    return (left.blockHeight - right.blockHeight) * direction;
  });

  const offset = (page - 1) * pageSize;
  const items = sorted.slice(offset, offset + pageSize);

  return {
    page,
    pageSize,
    total: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    latestHeight: transactionWindow.latestHeight,
    items,
    source: 'live'
  };
};

export const fetchTransactionDetailByHash = async (hash) => {
  const txResponse = await fetchTransactionByHash(hash);
  const latestHeight = await fetchLatestHeight();
  const isEvm = txResponse?.source === 'EVM';
  const blockHeight = Number(txResponse?.blockNumber || txResponse?.height || 0);
  const toAddress = isEvm ? txResponse.to : txResponse?.tx?.body?.messages?.[0]?.to_address || '';
  const decodedInput = isEvm ? decodeKnownInput(toAddress, txResponse.input) : null;
  // First-paint payload only — the heavy contract-events scan is loaded
  // separately via fetchDecodedLogsForTx so the page renders immediately.
  const cosmosTxResponse = isEvm
    ? await fetchCosmosTransactionByEvmHash(hash, blockHeight).catch(() => null)
    : null;

  return {
    txResponse,
    cosmosTxResponse,
    latestHeight,
    isEvm,
    blockHeight,
    confirmations: blockHeight > 0 ? Math.max(latestHeight - blockHeight, 0) : 0,
    decodedInput,
    knownContract: getKnownContract(toAddress) || getKnownToken(toAddress) || null,
    decodedLogs: [],
    decodedLogsPending: Boolean(isEvm && toAddress)
  };
};

// Lazy fetcher for the contract-events panel. Called by the tx-detail page
// after first paint so the eth_getLogs + N×eth_getBlockByNumber fan-out
// never blocks initial render. Safe to call repeatedly — fetchRecentContractEvents
// has its own 5-min TTL cache.
export const fetchDecodedLogsForTx = async (hash, toAddress) => {
  if (!toAddress) return [];
  const abi = getKnownContract(toAddress)?.abi || getKnownToken(toAddress)?.abi || [];
  const contractEvents = await fetchRecentContractEvents(toAddress, abi);
  return contractEvents.filter(
    (event) => event.txHash?.toLowerCase() === toEvmHash(hash).toLowerCase()
  );
};

export const fetchAddressesLandingData = async () => {
  const [summary, transactions] = await Promise.all([
    fetchExplorerSummary(),
    fetchTransactionsPage({ page: 1, pageSize: 8 })
  ]);

  return {
    summary,
    recentAddresses: [
      ...new Set(
        transactions.items
          .flatMap((transaction) => [transaction.fromAddress, transaction.toAddress])
          .filter(Boolean)
      )
    ].slice(0, 8)
  };
};

export const fetchAddressPageData = async (address) => {
  const normalizedInput = sanitizeSearchInput(address);
  const [balances, transactionWindow, tokenBalances, tokenTransfers, indexedProfile, derivedAssets, traceInternalProfile] = await Promise.all([
    mapAddressBalances(normalizedInput),
    fetchLiveTransactionWindow(),
    fetchTokenBalancesForAddress(normalizedInput),
    fetchAddressTokenTransfers(normalizedInput).catch(() => []),
    fetchIndexedAddressProfile(normalizedInput).catch(() => null),
    fetchDerivedAddressAssetProfile(normalizedInput).catch(() => ({ assets: [], nftInventorySupported: false })),
    fetchTraceInternalTransactions(normalizedInput).catch(() => ({ supported: false, items: [] }))
  ]);
  const hexAddress = balances.hexAddress;
  const [code, tokenCandidate] = await Promise.all([
    hexAddress ? publicProvider.getCode(hexAddress).catch(() => '0x') : Promise.resolve('0x'),
    hexAddress ? detectTokenContract(hexAddress) : Promise.resolve(null)
  ]);
  const transactions = matchTransactionsForAddress(transactionWindow.items, normalizedInput).slice(0, 50);
  const mergedAssetActivity = buildAddressAssetActivity({
    tokenBalances,
    tokenTransfers,
    indexedAssets: [
      ...(indexedProfile?.indexedAssets || []),
      ...(indexedProfile?.nftAssets || []),
      ...(derivedAssets?.assets || [])
    ]
  });
  const internalTransactions =
    indexedProfile?.internalTransactions?.length
      ? indexedProfile.internalTransactions
      : traceInternalProfile.items || [];
  const internalTransactionsSupported = Boolean(
    indexedProfile?.supportsInternalTransactions || traceInternalProfile.supported
  );
  const nftInventorySupported = Boolean(
    indexedProfile?.supportsNftInventory || derivedAssets?.nftInventorySupported
  );

  const totalIn = transactions
    .filter((transaction) => isSameAddress(transaction.toAddress, normalizedInput))
    .reduce((sum, transaction) => sum + BigInt(transaction.amount || '0'), 0n);
  const totalOut = transactions
    .filter((transaction) => isSameAddress(transaction.fromAddress, normalizedInput))
    .reduce((sum, transaction) => sum + BigInt(transaction.amount || '0'), 0n);

  return {
    address: normalizedInput,
    hexAddress,
    bech32Address: balances.bech32Address,
    account: balances.account,
    balances: balances.balances,
    nativeBalance: balances.nativeBalance,
    nativeBalanceDisplay: balances.nativeBalanceDisplay,
    tokenBalances,
    tokenTransfers,
    assetActivity: mergedAssetActivity.assets,
    nftAssets: mergedAssetActivity.nftAssets,
    internalTransactions,
    internalTransactionsSupported,
    nftInventorySupported,
    transactions,
    contractInteractions: transactions.filter(
      (transaction) => transaction.txType === 'contract' || (transaction.inputData && transaction.inputData !== '0x')
    ),
    assetCoverage: {
      observedAssets: mergedAssetActivity.assets.length,
      verifiedAssets: mergedAssetActivity.assets.filter((asset) => asset.verified).length,
      lep100Assets: mergedAssetActivity.tokenAssets.filter(
        (asset) => String(asset.type || '').toLowerCase() !== 'native'
      ).length,
      nftAssets: mergedAssetActivity.nftAssets.length
    },
    analytics: {
      totalTransactions: transactions.length,
      tokenTransfers: tokenTransfers.length,
      internalTransactions: internalTransactions.length,
      observedAssets: mergedAssetActivity.assets.length,
      nftAssets: mergedAssetActivity.nftAssets.length,
      inboundTransfers: formatTokenAmount(totalIn.toString()),
      outboundTransfers: formatTokenAmount(totalOut.toString()),
      uniqueCounterparties: new Set(
        transactions.flatMap((transaction) => [transaction.fromAddress, transaction.toAddress]).filter(Boolean)
      ).size
    },
    mode: code && code !== '0x' ? 'contract' : 'account',
    tokenCandidate,
    isContract: Boolean(code && code !== '0x')
  };
};

const extractArrayPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return [payload?.items, payload?.tokens, payload?.data, payload?.results].find(Array.isArray) || [];
};

const normalizeIndexedTokenRecord = (record = {}) => {
  const rawAddress = pickFirstPresentValue(record, [
    'contractAddress',
    'contract_address',
    'tokenAddress',
    'token_address',
    'address'
  ]);
  const contractAddress = toChecksumAddress(rawAddress) || '';
  const knownToken = contractAddress ? getKnownToken(contractAddress) || getKnownContract(contractAddress) : null;
  const type = String(
    pickFirstPresentValue(record, ['type', 'tokenType', 'token_type'], { allowEmptyString: true }) ||
      knownToken?.type ||
      (contractAddress ? 'LEP100' : 'native')
  ).trim();
  const verifiedValue = pickFirstPresentValue(record, ['verified', 'isVerified', 'verification.verified'], {
    allowEmptyString: true
  });

  return {
    id: String(
      pickFirstPresentValue(record, ['id'], { allowEmptyString: true }) ||
        contractAddress ||
        (type.toLowerCase() === 'native' ? 'native' : '')
    ).trim(),
    address: contractAddress,
    contractAddress,
    name: String(
      pickFirstPresentValue(record, ['name', 'tokenName', 'token_name']) || knownToken?.name || 'Token'
    ).trim(),
    symbol: String(
      pickFirstPresentValue(record, ['symbol', 'tokenSymbol', 'token_symbol']) ||
        knownToken?.symbol ||
        CHAIN_CONFIG.denom
    ).trim(),
    decimals: Number(
      pickFirstPresentValue(record, ['decimals'], { allowEmptyString: true }) ??
        knownToken?.decimals ??
        CHAIN_CONFIG.decimals
    ),
    totalSupply: normalizeNumericString(
      pickFirstPresentValue(record, ['totalSupply', 'total_supply', 'supply', 'amount'], {
        allowEmptyString: true
      }),
      ''
    ),
    holders: pickFirstPresentValue(record, ['holders', 'holdersCount', 'holderCount'], {
      allowEmptyString: true
    }),
    transfers: pickFirstPresentValue(record, ['transfers', 'transfersCount', 'transferCount'], {
      allowEmptyString: true
    }),
    type,
    verified: verifiedValue === null ? Boolean(knownToken?.verified) : Boolean(verifiedValue),
    creator: String(
      pickFirstPresentValue(record, ['creator', 'deployer', 'owner'], { allowEmptyString: true }) ||
        knownToken?.creator ||
        ''
    ).trim(),
    deploymentTimestamp: String(
      pickFirstPresentValue(record, ['deploymentTimestamp', 'deployment_timestamp', 'deployedAt'], {
        allowEmptyString: true
      }) ||
        knownToken?.deploymentTimestamp ||
        ''
    ).trim(),
    sourcePath: String(
      pickFirstPresentValue(record, ['sourcePath', 'source_path'], { allowEmptyString: true }) ||
        knownToken?.sourcePath ||
        ''
    ).trim(),
    verificationStatus: String(
      pickFirstPresentValue(record, ['verificationStatus', 'verification_status'], {
        allowEmptyString: true
      }) || ''
    ).trim()
  };
};

const mergeTokenCatalogRecord = (current, incoming) => ({
  ...current,
  ...incoming,
  id: incoming.id || current.id,
  address: incoming.address || current.address,
  contractAddress: incoming.contractAddress || current.contractAddress,
  name: incoming.name || current.name,
  symbol: incoming.symbol || current.symbol,
  decimals: Number.isFinite(Number(incoming.decimals)) ? incoming.decimals : current.decimals,
  totalSupply: incoming.totalSupply || current.totalSupply,
  holders:
    incoming.holders !== null && incoming.holders !== undefined && incoming.holders !== ''
      ? incoming.holders
      : current.holders,
  transfers:
    incoming.transfers !== null && incoming.transfers !== undefined && incoming.transfers !== ''
      ? incoming.transfers
      : current.transfers,
  type: incoming.type || current.type,
  verified: current.verified || Boolean(incoming.verified),
  creator: incoming.creator || current.creator,
  deploymentTimestamp: incoming.deploymentTimestamp || current.deploymentTimestamp,
  sourcePath: incoming.sourcePath || current.sourcePath,
  verificationStatus: incoming.verificationStatus || current.verificationStatus,
  holdersObservedCount: incoming.holdersObservedCount ?? current.holdersObservedCount ?? null,
  transfersObservedCount: incoming.transfersObservedCount ?? current.transfersObservedCount ?? null,
  lastTransferAt: incoming.lastTransferAt || current.lastTransferAt || '',
  ownershipSource: incoming.ownershipSource || current.ownershipSource || '',
  inventorySource: incoming.inventorySource || current.inventorySource || ''
});

const fetchIndexedTokenCatalog = async () =>
  withCache('indexed-token-catalog', TTL_SHORT, async () => {
    if (!CHAIN_CONFIG.explorerDataApiUrl) {
      return [];
    }

    const payload = await readExplorerApi('/tokens');
    return extractArrayPayload(payload)
      .map((record) => normalizeIndexedTokenRecord(record))
      .filter((record) => record.contractAddress || record.id === 'native');
  });

const withTimeout = (promise, ms, fallback) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);

const fetchKnownTokenActivityMap = async () =>
  withTimeout(
    withCache('known-token-activity-map', TTL_LONG, async () => {
      const activityEntries = await Promise.all(
        (await fetchActivityEligibleTokenCatalog()).map(async (token) => {
          const [recentTransfers, ownershipSnapshot] = await Promise.all([
            withTimeout(fetchTokenTransferHistory(token, { fullHistory: false }).catch(() => []), 8_000, []),
            fetchDerivedTokenOwnershipSnapshot(token).catch(() => null)
          ]);
        const recentTimestampMap = await fetchBlockTimestampMap(
          recentTransfers.map((event) => event.blockHeight)
        );
        const parsedRecentTransfers = recentTransfers.map((event) => ({
          txHash: event.txHash,
          blockHeight: event.blockHeight,
          timestamp: recentTimestampMap.get(event.blockHeight) || '',
          fromAddress: event.fromAddress || '',
          toAddress: event.toAddress || '',
          amount: event.amount || '0',
          amountDisplay: isNftTokenType(token)
            ? `Token #${event.tokenId || '--'}${event.quantity && event.quantity !== '1' ? ` x${event.quantity}` : ''}`
            : formatTokenAmount(event.amount || '0', token.decimals || 18)
        }));
        const observedHolders = buildObservedTokenHolders(parsedRecentTransfers);

        return [
          token.contractAddress.toLowerCase(),
          {
            holders:
              ownershipSnapshot?.holderCount !== undefined && ownershipSnapshot?.holderCount !== null
                ? ownershipSnapshot.holderCount
                : null,
            transfers:
              ownershipSnapshot?.transferCount !== undefined && ownershipSnapshot?.transferCount !== null
                ? ownershipSnapshot.transferCount
                : null,
            transfersObservedCount: parsedRecentTransfers.length,
            holdersObservedCount: observedHolders.length,
            lastTransferAt: ownershipSnapshot?.lastTransferAt || parsedRecentTransfers[0]?.timestamp || '',
            ownershipSource: ownershipSnapshot ? 'derived' : 'observed'
          }
        ];
      })
    );

    return new Map(activityEntries);
  }),
  12_000,
  new Map()
);

const fetchIndexedTokenDetail = async (contractAddress) =>
  withCache(`indexed-token-detail:${contractAddress.toLowerCase()}`, TTL_SHORT, async () => {
    if (!CHAIN_CONFIG.explorerDataApiUrl) {
      return null;
    }

    const payload = await readExplorerApi(`/tokens/${encodeURIComponent(contractAddress)}`);

    if (!isRecordObject(payload) && !Array.isArray(payload)) {
      return null;
    }

    const candidate = isRecordObject(payload?.data)
      ? payload.data
      : isRecordObject(payload?.token)
        ? payload.token
        : payload;
    const normalized = normalizeIndexedTokenRecord(candidate);

    return normalized.contractAddress || normalized.id === 'native' ? normalized : null;
  });

const normalizeIndexedTokenHolder = (record = {}, decimals = CHAIN_CONFIG.decimals) => {
  const address = String(
    pickFirstPresentValue(record, ['address', 'holder', 'owner'], { allowEmptyString: true }) || ''
  ).trim();

  if (!address) {
    return null;
  }

  const balance = normalizeNumericString(
    pickFirstPresentValue(record, ['balance', 'amount', 'quantity'], { allowEmptyString: true }),
    ''
  );

  return {
    address,
    balance,
    balanceDisplay: balance ? formatTokenAmount(balance, decimals) : '--',
    share: String(
      pickFirstPresentValue(record, ['share', 'percentage', 'ownershipPercent', 'ownership_percent'], {
        allowEmptyString: true
      }) || ''
    ).trim(),
    transfers: Number(
      pickFirstPresentValue(record, ['transfers', 'transferCount', 'transfer_count'], {
        allowEmptyString: true
      }) || 0
    ),
    lastSeen: String(
      pickFirstPresentValue(record, ['lastSeen', 'last_seen', 'updatedAt', 'updated_at'], {
        allowEmptyString: true
      }) || ''
    ).trim()
  };
};

const fetchIndexedTokenHolders = async (contractAddress, decimals = CHAIN_CONFIG.decimals) =>
  withCache(`indexed-token-holders:${contractAddress.toLowerCase()}`, TTL_SHORT, async () => {
    if (!CHAIN_CONFIG.explorerDataApiUrl) {
      return [];
    }

    const payload = await readExplorerApi(`/tokens/${encodeURIComponent(contractAddress)}/holders`);
    return extractArrayPayload(payload)
      .map((record) => normalizeIndexedTokenHolder(record, decimals))
      .filter(Boolean);
  });

export const fetchTokenCatalog = async ({ filter = 'all', includeActivity = false } = {}) => {
  const nativeToken = {
    id: 'native',
    address: '',
    contractAddress: '',
    name: 'Lithosphere',
    symbol: CHAIN_CONFIG.denom,
    decimals: CHAIN_CONFIG.decimals,
    totalSupply: '',
    type: 'native',
    verified: true
  };

  const [knownTokens, indexedTokens, supplyResponse, activityMap] = await Promise.all([
    fetchKnownTokenCatalog(),
    fetchIndexedTokenCatalog(),
    http.get(CosmosAPI.supplyByDenom(CHAIN_CONFIG.baseDenom)).catch(() => ({ data: { amount: null } })),
    includeActivity ? fetchKnownTokenActivityMap() : Promise.resolve(new Map())
  ]);
  const summary = includeActivity ? await fetchExplorerSummary().catch(() => null) : null;

  nativeToken.totalSupply = supplyResponse?.data?.amount?.amount || '';
  const catalogMap = new Map();

  [nativeToken, ...knownTokens, ...indexedTokens].forEach((token) => {
    const key = String(token.contractAddress || token.address || token.id || '').toLowerCase();

    if (!key) {
      return;
    }

    const current = catalogMap.get(key);
    catalogMap.set(key, current ? mergeTokenCatalogRecord(current, token) : token);
  });

  if (includeActivity) {
    activityMap.forEach((activity, addressKey) => {
      const current = catalogMap.get(addressKey);

      if (!current) {
        return;
      }

      catalogMap.set(
        addressKey,
        mergeTokenCatalogRecord(current, {
          ...current,
          holdersObservedCount: activity.holdersObservedCount,
          transfersObservedCount: activity.transfersObservedCount,
          lastTransferAt: activity.lastTransferAt
        })
      );
    });

    const nativeKey = 'native';
    const nativeToken = catalogMap.get(nativeKey);

    if (nativeToken && summary?.walletCount) {
      catalogMap.set(
        nativeKey,
        mergeTokenCatalogRecord(nativeToken, {
          ...nativeToken,
          holders: summary.walletCount,
          ownershipSource: 'derived'
        })
      );
    }
  }

  const catalog = [...catalogMap.values()];

  if (filter === 'fungible') {
    return catalog.filter((token) =>
      ['fungible', 'lep100', 'native'].includes(String(token.type || '').toLowerCase())
    );
  }

  if (filter === 'lep100') {
    return catalog.filter((token) => ['lep100', 'native'].includes(String(token.type || '').toLowerCase()));
  }

  if (filter === 'nft') {
    return catalog.filter((token) => isNftTokenType(token));
  }

  return catalog;
};

export const fetchTokenPageData = async (contract) => {
  const identifier = sanitizeSearchInput(contract).toLowerCase();

  if (identifier === 'native') {
    const [supplyResponse, summary] = await Promise.all([
      http.get(CosmosAPI.supplyByDenom(CHAIN_CONFIG.baseDenom)).catch(() => ({ data: { amount: null } })),
      fetchExplorerSummary().catch(() => null)
    ]);

    return {
      id: 'native',
      address: '',
      contractAddress: '',
      name: 'Lithosphere',
      symbol: CHAIN_CONFIG.denom,
      decimals: CHAIN_CONFIG.decimals,
      totalSupply: supplyResponse?.data?.amount?.amount || '',
      type: 'native',
      verified: true,
      verificationStatus: 'verified',
      holders: summary?.walletCount ?? null,
      holderSource: summary?.walletCount ? 'derived' : 'observed',
      holdersObservedCount: summary?.walletCount ?? null,
      exactHolders: [],
      observedHolders: [],
      recentTransfers: [],
      transfersCount: null,
      transfersObservedCount: null,
      creator: '',
      deploymentTimestamp: '',
      sourcePath: ''
    };
  }

  const checksumAddress = toChecksumAddress(identifier);

  if (!checksumAddress) {
    return null;
  }

  const [indexedToken, catalog] = await Promise.all([
    fetchIndexedTokenDetail(checksumAddress),
    fetchTokenCatalog({ includeActivity: true })
  ]);
  const catalogToken = catalog.find(
    (entry) => String(entry.contractAddress || entry.address || '').toLowerCase() === checksumAddress.toLowerCase()
  );
  const token =
    indexedToken ||
    catalogToken ||
    (await detectTokenContract(checksumAddress)) ||
    getKnownToken(checksumAddress);

  if (!token) {
    return null;
  }

  const [metadata, recentTransferEvents, indexedExactHolders] = await Promise.all([
    fetchTokenMetadata(token),
    fetchTokenTransferHistory(token, { fullHistory: false }),
    fetchIndexedTokenHolders(checksumAddress, token.decimals ?? CHAIN_CONFIG.decimals)
  ]);

  const [recentTransferTimestampMap, derivedOwnership, nftPreviewTokens] = await Promise.all([
    fetchBlockTimestampMap(recentTransferEvents.map((event) => event.blockHeight)),
    indexedExactHolders.length > 0
      ? Promise.resolve(null)
      : fetchDerivedTokenOwnershipSnapshot(token).catch(() => null),
    isNftTokenType(token)
      ? fetchNftPreviewTokens(token, recentTransferEvents).catch(() => [])
      : Promise.resolve([])
  ]);

  const recentTransfers = recentTransferEvents
    .slice(-25)
    .reverse()
    .map((event) => ({
      txHash: event.txHash,
      blockHeight: event.blockHeight,
      timestamp: recentTransferTimestampMap.get(event.blockHeight) || '',
      fromAddress: event.fromAddress || '',
      toAddress: event.toAddress || '',
      amount: event.amount || '0',
      amountDisplay: isNftTokenType(metadata)
        ? `Token #${event.tokenId || '--'}${event.quantity && event.quantity !== '1' ? ` x${event.quantity}` : ''}`
        : formatTokenAmount(event.amount || '0', metadata.decimals)
    }));
  const observedHolders = buildObservedTokenHolders(recentTransfers);
  const totalSupplyBigInt =
    metadata.totalSupply && metadata.totalSupply !== '0' ? BigInt(metadata.totalSupply) : 0n;
  const derivedExactHolders = (derivedOwnership?.holders || []).map((holder) => {
    const holderBalance = BigInt(holder.balance || '0');
    const share =
      totalSupplyBigInt > 0n
        ? `${((Number(holderBalance * 10000n / totalSupplyBigInt) || 0) / 100).toFixed(2)}%`
        : '';

    return {
      address: holder.address,
      balance: holder.balance,
      balanceDisplay: holder.balanceDisplay,
      share,
      transfers: holder.transfers || 0,
      lastSeen: holder.lastSeen || ''
    };
  });
  const exactHolders = indexedExactHolders.length ? indexedExactHolders : derivedExactHolders;
  const holderSource = indexedExactHolders.length
    ? 'indexed'
    : derivedExactHolders.length
      ? 'derived'
      : observedHolders.length
        ? 'observed'
        : 'unavailable';

  return {
    ...metadata,
    ...indexedToken,
    recentTransfers,
    holders:
      indexedToken?.holders ??
      catalogToken?.holders ??
      (exactHolders.length ? exactHolders.length : observedHolders.length || null),
    holdersObservedCount: observedHolders.length,
    exactHolders,
    observedHolders,
    holderSource,
    transfersCount:
      indexedToken?.transfers ??
      catalogToken?.transfers ??
      catalogToken?.transfersObservedCount ??
      derivedOwnership?.transferCount ??
      recentTransferEvents.length,
    transfersObservedCount: catalogToken?.transfersObservedCount ?? recentTransferEvents.length,
    verificationStatus:
      indexedToken?.verificationStatus || (metadata.verified ? 'verified' : 'unverified'),
    collectionMetadata: metadata.collectionMetadata || null,
    collectionMetadataUri: metadata.collectionMetadataUri || '',
    nftPreviewTokens
  };
};

export const fetchValidatorsPage = async () => {
  const validators = await fetchValidatorAugmentedList();
  return {
    items: validators
  };
};

export const fetchValidatorPageData = async (operatorAddress) => {
  const validators = await fetchValidatorAugmentedList();
  const validator = validators.find(
    (candidate) => candidate.operator_address.toLowerCase() === operatorAddress.toLowerCase()
  );

  if (!validator) {
    return null;
  }

  const recentBlocks = (await fetchBlocksForPage(1, 50)).items.filter(
    (block) => block.proposerAddress.toLowerCase() === validator.operator_address.toLowerCase()
  );

  return {
    ...validator,
    recentBlocks,
    votingPowerLabel: formatTokenAmount(String(getValidatorVotingPower(validator))),
    commissionLabel: formatPercent(
      Number(validator.commission?.commission_rates?.rate || 0) * 100
    ),
    uptimeLabel: formatPercent(validator.uptime || 0)
  };
};

export const fetchContractsPage = async () => {
  const knownTokens = await fetchKnownTokenCatalog();
  return {
    items: [...KAMET_KNOWN_CONTRACTS, ...knownTokens]
  };
};

export const fetchContractPageData = async (address) => {
  const checksumAddress = toChecksumAddress(address);

  if (!checksumAddress) {
    return null;
  }

  const code = await publicProvider.getCode(checksumAddress).catch(() => '0x');

  if (!code || code === '0x') {
    return null;
  }

  const knownContract = getKnownContract(checksumAddress) || getKnownToken(checksumAddress);
  const tokenCandidate = knownContract?.type === 'bridge' ? null : await detectTokenContract(checksumAddress);
  const verificationStatus = await fetchContractStatusApi(checksumAddress);
  const sourcePayload = await fetchContractSourceApi(checksumAddress);
  const abi = safeJsonParse(sourcePayload?.abi, null) || sourcePayload?.abi || knownContract?.abi || tokenCandidate?.abi || [];
  const interfaceInstance = buildContractInterface(abi);
  const recentEvents = await fetchRecentContractEvents(checksumAddress, abi);

  return {
    address: checksumAddress,
    name: tokenCandidate?.name || sourcePayload?.name || knownContract?.name || 'Smart Contract',
    symbol: tokenCandidate?.symbol || knownContract?.symbol || '',
    type: tokenCandidate?.type || knownContract?.type || 'contract',
    code,
    verified:
      Boolean(knownContract?.verified) ||
      Boolean(verificationStatus?.verified) ||
      Boolean(sourcePayload?.verified),
    verificationSource:
      knownContract?.verified
        ? 'core'
        : verificationStatus?.verified || sourcePayload?.verified
          ? 'api'
          : 'unverified',
    creator: sourcePayload?.creator || knownContract?.creator || '',
    deploymentTx: sourcePayload?.creation_tx || knownContract?.deploymentTx || '',
    deploymentTimestamp: knownContract?.deploymentTimestamp || '',
    sourcePath: knownContract?.sourcePath || sourcePayload?.sourcePath || '',
    deploymentSource: knownContract?.deploymentSource || '',
    abi,
    readFunctions: getReadableFunctions(interfaceInstance),
    writeFunctions: getWritableFunctions(interfaceInstance),
    events: interfaceInstance ? Object.values(interfaceInstance.events) : [],
    recentEvents,
    sourceCode: sourcePayload?.sourceCode || sourcePayload?.source_code || '',
    knownContract: knownContract || tokenCandidate || null
  };
};

const buildSearchResult = (type, label, value, path, meta = {}) => ({
  type,
  label,
  value,
  path,
  ...meta
});

export const searchExplorer = async (query) => {
  const normalizedQuery = sanitizeSearchInput(query);
  const malformedInput = detectMalformedSearchInput(normalizedQuery);

  if (!normalizedQuery) {
    return {
      status: 'invalid',
      reason: 'Enter a block, transaction, address, token symbol, or validator operator address.',
      results: []
    };
  }

  if (malformedInput) {
    return {
      status: malformedInput.kind === 'unsupported_object_type' ? 'unsupported' : 'invalid',
      reason: malformedInput.message,
      results: []
    };
  }

  try {
    if (looksLikeHeight(normalizedQuery)) {
      const block = await fetchBlockDetailById(normalizedQuery).catch(() => null);
      return block
        ? {
            status: 'results',
            reason: '',
            results: [
              buildSearchResult('block', `Block #${block.height}`, block.hash, `/block/${block.height}`, {
                subtitle: block.timestamp
              })
            ]
          }
        : {
            status: 'not_found',
            reason: 'No block found for that height.',
            results: []
          };
    }

    if (looksLikeValidatorOperator(normalizedQuery)) {
      const validator = await fetchValidatorPageData(normalizedQuery).catch(() => null);
      return validator
        ? {
            status: 'results',
            reason: '',
            results: [
              buildSearchResult(
                'validator',
                validator.moniker,
                validator.operator_address,
                `/validator/${validator.operator_address}`,
                {
                  subtitle: validator.statusLabel
                }
              )
            ]
          }
        : {
            status: 'not_found',
            reason: 'No validator found for that operator address.',
            results: []
          };
    }

    if (looksLikeAddress(normalizedQuery)) {
      const checksumAddress = toHexAddress(normalizedQuery);
      const token = checksumAddress ? await detectTokenContract(checksumAddress) : null;
      const code = checksumAddress ? await publicProvider.getCode(checksumAddress).catch(() => '0x') : '0x';

      if (token) {
        return {
          status: 'results',
          reason: '',
          results: [
            buildSearchResult('token', token.symbol || token.name, token.address, `/token/${token.address}`, {
              subtitle: token.name
            })
          ]
        };
      }

      if (code && code !== '0x') {
        return {
          status: 'results',
          reason: '',
          results: [
            buildSearchResult('contract', checksumAddress, checksumAddress, `/contract/${checksumAddress}`, {
              subtitle: 'Smart contract'
            })
          ]
        };
      }

      return {
        status: 'results',
        reason: '',
        results: [
          buildSearchResult('address', normalizedQuery, normalizedQuery, `/address/${normalizedQuery}`, {
            subtitle: 'Wallet / account'
          })
        ]
      };
    }

    if (looksLikeTxHash(normalizedQuery) || looksLikeBlockHash(normalizedQuery)) {
      const transaction = await fetchTransactionByHash(normalizedQuery).catch(() => null);

      if (transaction) {
        const txHash = transaction?.source === 'EVM' ? transaction.evmHash : toEvmHash(normalizedQuery);
        return {
          status: 'results',
          reason: '',
          results: [
            buildSearchResult('transaction', 'Transaction', txHash, `/tx/${txHash || normalizedQuery}`, {
              subtitle: transaction.timestamp || ''
            })
          ]
        };
      }

      const block = await fetchBlockDetailById(normalizedQuery).catch(() => null);
      if (block) {
        return {
          status: 'results',
          reason: '',
          results: [
            buildSearchResult('block', `Block #${block.height}`, block.hash, `/block/${block.hash}`, {
              subtitle: block.timestamp
            })
          ]
        };
      }

      return {
        status: 'not_found',
        reason: 'No transaction or block found for that hash.',
        results: []
      };
    }

    const tokenCatalog = await fetchTokenCatalog();
    const exactToken = KAMET_TOKEN_SYMBOL_INDEX.get(normalizedQuery.toLowerCase()) || null;
    const fuzzyTokens = tokenCatalog.filter((token) => {
      const haystack = `${token.symbol} ${token.name}`.toLowerCase();
      return haystack.includes(normalizedQuery.toLowerCase());
    });

    if (exactToken) {
      return {
        status: 'results',
        reason: '',
        results: [
          buildSearchResult('token', exactToken.symbol, exactToken.address, `/token/${exactToken.address}`, {
            subtitle: exactToken.name
          })
        ]
      };
    }

    if (fuzzyTokens.length > 0) {
      return {
        status: 'results',
        reason: '',
        results: fuzzyTokens.map((token) =>
          buildSearchResult('token', token.symbol, token.contractAddress || token.address, `/token/${token.contractAddress || token.address || 'native'}`, {
            subtitle: token.name
          })
        )
      };
    }

    return {
      status: 'not_found',
      reason: 'No result found. Data may still be indexing or the network may be delayed.',
      results: []
    };
  } catch (error) {
    captureExplorerError(error, {
      feature: 'search',
      query: normalizedQuery
    });

    return {
      status: 'delayed',
      reason: 'Search is temporarily degraded. The network may be delayed or the indexer may be unavailable.',
      results: []
    };
  }
};

export const resolveSearchDestination = async (query) => {
  const normalizedQuery = sanitizeSearchInput(query);

  if (looksLikeHeight(normalizedQuery)) {
    return {
      type: 'direct',
      path: `/block/${normalizedQuery}`
    };
  }

  if (looksLikeTxHash(normalizedQuery)) {
    return {
      type: 'direct',
      path: `/tx/${normalizedQuery}`
    };
  }

  if (looksLikeValidatorOperator(normalizedQuery)) {
    return {
      type: 'direct',
      path: `/validator/${normalizedQuery}`
    };
  }

  const search = await searchExplorer(query);

  if (search.status === 'results' && search.results.length === 1) {
    return {
      type: 'direct',
      path: search.results[0].path
    };
  }

  return {
    type: 'search',
    path: `/search?q=${encodeURIComponent(sanitizeSearchInput(query))}`
  };
};

export const fetchNetworkOverview = async () => {
  const [statusSnapshot, statusMetrics, latestBlock, latestHeight, explorerSummary] = await Promise.all([
    fetchStatusSnapshot(),
    fetchStatusMetricsSnapshot(),
    fetchLatestBlock(),
    fetchLatestHeight(),
    fetchExplorerSummaryApi()
  ]);
  const networkId = String(statusSnapshot?.id || statusMetrics?.network || 'kamet').toLowerCase();
  const activeAlerts = Array.isArray(statusMetrics?.active_alerts)
    ? statusMetrics.active_alerts
        .filter((incident) => !incident?.network || String(incident.network).toLowerCase() === networkId)
        .map((incident) => normalizeStatusIncident(incident))
    : [];
  const recentEvents = Array.isArray(statusMetrics?.recent_events || statusMetrics?.alerts)
    ? (statusMetrics.recent_events || statusMetrics.alerts)
        .filter((event) => !event?.network || String(event.network).toLowerCase() === networkId)
        .map((event) => normalizeStatusEvent(event))
    : [];
  const tpsValue = Number(statusSnapshot?.tps);
  const recentTxCount = Number(statusSnapshot?.recentTxCount ?? statusSnapshot?.recent_tx_count);
  const indexingLag =
    explorerSummary && Number.isFinite(Number(explorerSummary.chainTipHeight))
      ? Math.max(0, latestHeight - Number(explorerSummary.chainTipHeight))
      : 0;
  const rawComponentStatuses = pickStatusArray(
    statusMetrics?.component_statuses,
    statusMetrics?.componentStatuses,
    statusMetrics?.services,
    statusMetrics?.service_statuses,
    statusMetrics?.serviceStatuses,
    statusMetrics?.components,
    statusSnapshot?.component_statuses,
    statusSnapshot?.componentStatuses,
    statusSnapshot?.services,
    statusSnapshot?.service_statuses,
    statusSnapshot?.serviceStatuses,
    statusSnapshot?.components
  );
  const explicitComponentStatuses = rawComponentStatuses
    .filter((component) => !component?.network || String(component.network).toLowerCase() === networkId)
    .map((component, index) => normalizeComponentStatusRecord(component, `component-${index + 1}`))
    .filter((component) => component.title || component.component);
  const derivedComponentStatuses = buildDerivedComponentStatuses({
    statusSnapshot,
    latestBlock,
    explorerSummary,
    indexingLag
  });
  const componentStatuses = sortStatusRecords(
    mergeStatusRecords(explicitComponentStatuses, derivedComponentStatuses),
    ['lastChecked']
  );
  const scheduledMaintenance = sortStatusRecords(
    pickStatusArray(
      statusMetrics?.scheduled_maintenance,
      statusMetrics?.scheduledMaintenance,
      statusMetrics?.maintenance_windows,
      statusMetrics?.maintenanceWindows,
      statusMetrics?.upcoming_maintenance,
      statusMetrics?.upcomingMaintenance,
      statusMetrics?.maintenances,
      statusMetrics?.maintenance,
      statusSnapshot?.scheduled_maintenance,
      statusSnapshot?.scheduledMaintenance,
      statusSnapshot?.maintenance_windows,
      statusSnapshot?.maintenanceWindows,
      statusSnapshot?.upcoming_maintenance,
      statusSnapshot?.upcomingMaintenance,
      statusSnapshot?.maintenances,
      statusSnapshot?.maintenance
    )
      .filter((maintenance) => !maintenance?.network || String(maintenance.network).toLowerCase() === networkId)
      .map((maintenance) => normalizeStatusMaintenance(maintenance)),
    ['startedAt', 'updatedAt', 'createdAt']
  );
  const incidentHistory = sortStatusRecords(
    pickStatusArray(
      statusMetrics?.incident_history,
      statusMetrics?.incidentHistory,
      statusMetrics?.resolved_incidents,
      statusMetrics?.resolvedIncidents,
      statusMetrics?.incidents,
      statusMetrics?.history,
      statusSnapshot?.incident_history,
      statusSnapshot?.incidentHistory,
      statusSnapshot?.resolved_incidents,
      statusSnapshot?.resolvedIncidents,
      statusSnapshot?.incidents,
      statusSnapshot?.history
    )
      .filter((incident) => !incident?.network || String(incident.network).toLowerCase() === networkId)
      .map((incident) => normalizeStatusIncident(incident))
      .filter((incident) => {
        const activeKey = String(incident.incidentKey || '').trim().toLowerCase();
        return !activeAlerts.some((activeIncident) => {
          const currentKey = String(activeIncident.incidentKey || '').trim().toLowerCase();
          return currentKey && activeKey && currentKey === activeKey;
        });
      }),
    ['resolvedAt', 'updatedAt', 'lastEventAt', 'startedAt']
  );
  const nodes = Array.isArray(statusSnapshot?.nodes) ? statusSnapshot.nodes : [];
  const totalNodes = Number(statusSnapshot?.totalNodes ?? nodes.length);
  const onlineNodes =
    Number(statusSnapshot?.onlineNodes) ||
    nodes.filter((node) => String(node.syncStatus || '').toLowerCase() === 'synced').length;
  const monitorSummary = buildMonitorSummary({
    statusSnapshot,
    statusMetrics,
    nodes,
    componentStatuses,
    activeAlerts,
    recentEvents,
    incidentHistory,
    scheduledMaintenance
  });

  return {
    chainHealth: statusSnapshot?.statusLevel || 'unknown',
    statusMessage: statusSnapshot?.statusMessage || 'Public status API unavailable.',
    latency: nodes.length
      ? Math.round(
          nodes.reduce((sum, node) => sum + Number(node.latency || 0), 0) /
            nodes.length
        )
      : null,
    indexingLag,
    apiStatus: {
      statusApi: Boolean(statusSnapshot),
      rpc: Boolean(latestBlock?.header?.height),
      rest: Boolean(latestBlock?.header?.height)
    },
    tps: Number.isFinite(tpsValue) ? tpsValue : null,
    recentTxCount: Number.isFinite(recentTxCount) ? recentTxCount : null,
    activeAlerts: sortStatusRecords(activeAlerts, ['updatedAt', 'lastEventAt', 'startedAt']),
    recentEvents: sortStatusRecords(recentEvents, ['resolvedAt', 'updatedAt', 'timestamp', 'createdAt']),
    componentStatuses,
    scheduledMaintenance,
    incidentHistory,
    monitorSummary: {
      ...monitorSummary,
      onlineNodes: monitorSummary.onlineNodes || onlineNodes,
      totalNodes: monitorSummary.totalNodes || totalNodes
    },
    latestHeight,
    latestBlockTime: latestBlock?.header?.time || '',
    statusSnapshot
  };
};

export const runReadContractFunction = async (address, abi, functionName, args = []) => {
  const contract = new ethers.Contract(address, abi, publicProvider);
  const result = await contract[functionName](...args);

  if (ethers.BigNumber.isBigNumber(result)) {
    return result.toString();
  }

  if (Array.isArray(result)) {
    return result.map((entry) => (ethers.BigNumber.isBigNumber(entry) ? entry.toString() : String(entry)));
  }

  return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
};
