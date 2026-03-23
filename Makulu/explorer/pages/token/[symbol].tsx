import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { ApiToken } from '@/lib/types';

export default function TokenDetailPage() {
  const router = useRouter();
  const { symbol } = router.query;

  const { data: tokens, loading, error } = useApi<ApiToken[]>('/tokens');

  const token = tokens?.find(
    (t) => t.symbol.toLowerCase() === String(symbol ?? '').toLowerCase()
  );

  if (loading) {
    return (
      <div className="text-white animate-pulse space-y-6">
        <div className="h-5 rounded bg-white/10 w-24" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-8 rounded bg-white/10 w-40" />
            <div className="h-4 rounded bg-white/10 w-20" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
              <div className="h-3 rounded bg-white/10 w-20" />
              <div className="h-6 rounded bg-white/10 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <div className="text-lg font-medium text-red-300 mb-2">Token Not Found</div>
          <div className="text-sm text-white/50 mb-4">
            {error ?? `No token found with symbol "${symbol}".`}
          </div>
          <Link href="/tokens" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Tokens
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{token.symbol} - {token.name} | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          <Link href="/tokens" className="hover:text-white/70 transition">Tokens</Link>
          <span>/</span>
          <span className="text-white/70">{token.symbol}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4">
          {token.type === 'native' ? (
            <img src="/litho-logo.png" alt={token.symbol} className="w-14 h-14 rounded-full object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-2xl font-bold text-white">
              {token.symbol.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold">{token.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg text-white/50">{token.symbol}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {token.type}
              </span>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Total Supply</div>
            <div className="text-xl font-semibold font-mono">
              {token.totalSupply ? formatNumber(token.totalSupply) : '—'}
            </div>
            <div className="text-xs text-white/30 mt-1">{token.symbol}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Holders</div>
            <div className="text-xl font-semibold">
              {token.holders != null ? formatNumber(token.holders) : '—'}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Decimals</div>
            <div className="text-xl font-semibold">{token.decimals}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">{token.contractAddress ? 'Contract' : 'Type'}</div>
            <div className="text-xl font-semibold">
              {token.contractAddress ? (
                <Link
                  href={`/address/${token.contractAddress}`}
                  className="text-emerald-300 hover:text-emerald-200 font-mono text-sm transition"
                >
                  {token.contractAddress.slice(0, 10)}...
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-0.5 text-sm text-emerald-300">
                  Native Chain Asset
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Token details */}
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-2">
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Name</div>
            <div className="flex-1 text-sm text-white">{token.name}</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Symbol</div>
            <div className="flex-1 text-sm text-white font-mono">{token.symbol}</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Decimals</div>
            <div className="flex-1 text-sm text-white font-mono">{token.decimals}</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Type</div>
            <div className="flex-1 text-sm text-white">{token.type === 'native' ? 'Native Chain Asset' : 'LEP-100 Token'}</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Denom</div>
            <div className="flex-1 text-sm text-white font-mono">ulitho</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4">
            <div className="sm:w-40 shrink-0 text-sm text-white/45">Chain</div>
            <div className="flex-1 text-sm text-white font-mono">lithosphere_700777-1</div>
          </div>
        </div>
      </div>
    </>
  );
}
