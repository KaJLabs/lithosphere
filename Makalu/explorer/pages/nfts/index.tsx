import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE, POLL_INTERVAL } from '@/lib/constants';
import { formatNumber, truncateHash, timeAgo, preferLitho, truncateAddressSmart } from '@/lib/format';
import type { ApiNftCollection, ApiNftTransferList } from '@/lib/types';

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-cyan-500',
];

function getAvatarColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ITEMS_PER_PAGE = 25;

function NftBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
      LEP100-6
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-4"><div className="h-4 w-6 bg-white/10 rounded animate-pulse" /></td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          <div className="space-y-1">
            <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-28 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4"><div className="h-4 w-12 bg-white/10 rounded animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-4 w-12 bg-white/10 rounded animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-4 w-12 bg-white/10 rounded animate-pulse" /></td>
      <td className="px-4 py-4"><div className="h-4 w-32 bg-white/10 rounded animate-pulse" /></td>
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <svg className="w-12 h-12 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  );
}

export default function NftsPage() {
  const router = useRouter();
  const { data: collections, loading, error } = useApi<ApiNftCollection[]>('/nfts', {
    pollInterval: POLL_INTERVAL,
  });
  const { data: transfersData } = useApi<ApiNftTransferList>('/nfts/transfers?limit=15', {
    pollInterval: POLL_INTERVAL,
  });
  const [page, setPage] = useState(1);

  const total = collections?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageItems = collections?.slice(startIdx, startIdx + ITEMS_PER_PAGE) ?? [];
  const transfers = transfersData?.transfers ?? [];

  return (
    <>
      <Head>
        <title>NFTs | {EXPLORER_TITLE}</title>
      </Head>

      <div className="w-full min-w-0 max-w-7xl mx-auto py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">NFT Collections</h1>
          <p className="text-sm text-white/40 mt-1">
            {!loading && collections
              ? `A total of ${formatNumber(total)} LEP100-6 collection${total !== 1 ? 's' : ''} found`
              : 'LEP100-6 (ERC-721) collections, items, holders, and transfers on Makalu'}
          </p>
        </div>

        {/* Collections */}
        <div className="w-full min-w-0 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          {error && <EmptyState message={error} />}

          {loading && !error && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Collection</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Holders</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Transfers</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-white/[0.03] rounded-2xl border border-white/5 animate-pulse" />
                ))}
              </div>
            </>
          )}

          {!loading && !error && total === 0 && (
            <EmptyState message="No NFT collections found yet" />
          )}

          {!loading && !error && total > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Collection</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Holders</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Transfers</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c, idx) => {
                      const href = `/token/${c.contractAddress}`;
                      return (
                        <tr
                          key={c.contractAddress}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer"
                          onClick={() => router.push(href)}
                        >
                          <td className="px-4 py-4 text-sm text-white/40">{startIdx + idx + 1}</td>
                          <td className="px-4 py-4">
                            <Link href={href} className="flex items-center gap-3 group">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(c.symbol)}`}>
                                {c.symbol.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-white group-hover:text-emerald-300 transition">
                                  {c.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-white/40">
                                  <span>{c.symbol}</span>
                                  <NftBadge />
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-sm text-white/70 text-right tabular-nums">{formatNumber(c.items)}</td>
                          <td className="px-4 py-4 text-sm text-white/70 text-right tabular-nums">{formatNumber(c.holders)}</td>
                          <td className="px-4 py-4 text-sm text-white/70 text-right tabular-nums">{formatNumber(c.transfers)}</td>
                          <td className="px-4 py-4 text-sm">
                            <Link
                              href={`/address/${preferLitho(c.contractAddress)}`}
                              className="text-emerald-300 hover:text-emerald-200 font-mono transition"
                              title={`${preferLitho(c.contractAddress)}\n${c.contractAddress}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {truncateAddressSmart(preferLitho(c.contractAddress))}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden p-4 space-y-3">
                {pageItems.map((c, idx) => (
                  <Link
                    key={c.contractAddress}
                    href={`/token/${c.contractAddress}`}
                    className="block min-w-0 overflow-hidden bg-white/[0.03] rounded-2xl p-4 border border-white/5 hover:bg-white/[0.06] transition"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3 mb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${getAvatarColor(c.symbol)}`}>
                          {c.symbol.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                          <div className="truncate text-xs text-white/40">{c.symbol}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-white/30">#{startIdx + idx + 1}</span>
                        <NftBadge />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-white/30 mb-0.5">Items</div>
                        <div className="text-white/70 tabular-nums">{formatNumber(c.items)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/30 mb-0.5">Holders</div>
                        <div className="text-white/70 tabular-nums">{formatNumber(c.holders)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/30 mb-0.5">Transfers</div>
                        <div className="text-white/70 tabular-nums">{formatNumber(c.transfers)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="text-xs text-white/30 mb-0.5">Contract</div>
                      <span className="block max-w-full truncate text-sm font-mono text-emerald-300">
                        {truncateAddressSmart(preferLitho(c.contractAddress))}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 px-4 py-4 border-t border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-white/30">
                    Showing {startIdx + 1} to {Math.min(startIdx + ITEMS_PER_PAGE, total)} of {formatNumber(total)}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/60 px-3 py-1.5">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent NFT transfers */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Recent NFT Transfers</h2>
          </div>
          <div className="w-full min-w-0 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {transfers.length === 0 ? (
              <EmptyState message="No NFT transfers indexed yet" />
            ) : (
              <div className="divide-y divide-white/5">
                {transfers.map((t) => {
                  const txHash = t.txHash;
                  return (
                    <div key={`${t.txHash}-${t.tokenId}-${t.blockHeight}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/token/${t.contractAddress}`}
                            className="truncate text-sm font-semibold text-white hover:text-emerald-300 transition"
                          >
                            {t.collectionName ?? t.collectionSymbol ?? truncateAddressSmart(preferLitho(t.contractAddress))}
                          </Link>
                          {t.tokenId != null && (
                            <span className="shrink-0 rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300">
                              #{t.tokenId}
                            </span>
                          )}
                        </div>
                        {txHash && (
                          <Link
                            href={`/txs/${txHash}`}
                            className="mt-1 block truncate font-mono text-xs text-emerald-300/80 hover:text-emerald-200 transition"
                          >
                            {truncateHash(txHash)}
                          </Link>
                        )}
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-white/60">
                        <Link href={`/address/${preferLitho(t.fromAddress)}`} className="truncate font-mono hover:text-white transition" title={`${preferLitho(t.fromAddress)}\n${t.fromAddress}`}>
                          {truncateAddressSmart(preferLitho(t.fromAddress), 5)}
                        </Link>
                        <span className="shrink-0 text-white/30">→</span>
                        <Link href={`/address/${preferLitho(t.toAddress)}`} className="truncate font-mono hover:text-white transition" title={`${preferLitho(t.toAddress)}\n${t.toAddress}`}>
                          {truncateAddressSmart(preferLitho(t.toAddress), 5)}
                        </Link>
                      </div>
                      <div className="shrink-0 text-xs tabular-nums text-white/40">
                        {t.timestamp ? timeAgo(t.timestamp) : `#${formatNumber(t.blockHeight)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
