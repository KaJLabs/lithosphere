import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shortenMiddle } from '../../helpers/explorer';
import { fetchTransactionsPage } from '../../services/explorerDataService';
import {
  evmAddress,
  latestHeight,
  secondaryEvmAddress,
  secondaryTxHash,
  timestampForHeight,
  txHash
} from '../../test/fixtures/explorerFixtures';
import TransactionSearch from './TransactionSearch';

vi.mock('../../services/explorerDataService', async () => {
  const actual = await vi.importActual('../../services/explorerDataService');

  return {
    ...actual,
    fetchTransactionsPage: vi.fn()
  };
});

const buildTransactionRecord = ({ hash = txHash, height = latestHeight, overrides = {} } = {}) => ({
  hash,
  evmHash: `0x${hash.toLowerCase()}`,
  blockHeight: height,
  timestamp: timestampForHeight(height),
  fromAddress: evmAddress,
  toAddress: secondaryEvmAddress,
  amount: '1000000000000000000',
  amountDisplay: '1.0000 LITHO',
  feeAmount: '4200000000000000',
  feeDisplay: '0.0042 LITHO',
  gasUsed: 21000,
  gasWanted: 30000,
  method: 'Send',
  txType: 'transfer',
  success: true,
  status: 'Success',
  ...overrides
});

const buildTransactionsPayload = (items, overrides = {}) => ({
  page: 1,
  pageSize: 15,
  total: items.length,
  totalPages: 1,
  latestHeight,
  items,
  ...overrides
});

const getRenderedHash = (transaction) => shortenMiddle(transaction.evmHash, 8, 6);

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const createDeferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
};

const renderTransactionSearch = () =>
  render(
    <MemoryRouter>
      <TransactionSearch />
    </MemoryRouter>
  );

describe('TransactionSearch', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchTransactionsPage.mockReset();
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = vi.fn(() => {
      throw new Error('Disable websocket transport in unit tests');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it('loads transactions on mount and polls every 12 seconds', async () => {
    const initialTransaction = buildTransactionRecord({ height: latestHeight - 2 });
    const polledTransaction = buildTransactionRecord({ hash: secondaryTxHash, height: latestHeight });

    fetchTransactionsPage
      .mockResolvedValueOnce(buildTransactionsPayload([initialTransaction], { total: 215235, totalPages: 14349 }))
      .mockResolvedValueOnce(buildTransactionsPayload([polledTransaction, initialTransaction], { total: 2 }));

    renderTransactionSearch();
    await flushMicrotasks();

    expect(fetchTransactionsPage).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 15,
      sortBy: 'blockHeight',
      sortDirection: 'desc'
    });
    expect(screen.getByText(getRenderedHash(initialTransaction))).toBeInTheDocument();
    expect(screen.getByText('215,235 transactions')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 14,349')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    await flushMicrotasks();

    expect(fetchTransactionsPage).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 15,
      sortBy: 'blockHeight',
      sortDirection: 'desc'
    });
    expect(screen.getByText(getRenderedHash(polledTransaction))).toBeInTheDocument();
    expect(screen.getByText(getRenderedHash(initialTransaction))).toBeInTheDocument();
  });

  it('cleans up the polling interval on unmount', async () => {
    fetchTransactionsPage.mockResolvedValue(
      buildTransactionsPayload([buildTransactionRecord({ height: latestHeight - 1 })])
    );

    const { unmount } = renderTransactionSearch();
    await flushMicrotasks();

    expect(fetchTransactionsPage).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24000);
    });
    await flushMicrotasks();

    expect(fetchTransactionsPage).toHaveBeenCalledTimes(1);
  });

  it('keeps the current table visible while a background refresh is pending', async () => {
    const initialTransaction = buildTransactionRecord({ height: latestHeight - 2 });
    const newTransaction = buildTransactionRecord({ hash: secondaryTxHash, height: latestHeight });
    const deferredRefresh = createDeferred();

    fetchTransactionsPage
      .mockResolvedValueOnce(buildTransactionsPayload([initialTransaction]))
      .mockReturnValueOnce(deferredRefresh.promise);

    renderTransactionSearch();
    await flushMicrotasks();

    expect(screen.getByText(getRenderedHash(initialTransaction))).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    await flushMicrotasks();

    expect(fetchTransactionsPage).toHaveBeenCalledTimes(2);
    expect(screen.getByText(getRenderedHash(initialTransaction))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();

    await act(async () => {
      deferredRefresh.resolve(buildTransactionsPayload([newTransaction]));
    });
    await flushMicrotasks();

    expect(screen.getByText(getRenderedHash(newTransaction))).toBeInTheDocument();
    expect(screen.queryByText(getRenderedHash(initialTransaction))).not.toBeInTheDocument();
  });
});
