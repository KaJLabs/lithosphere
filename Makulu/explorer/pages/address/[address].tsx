import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, truncateHash, timeAgo, formatTimestamp } from '@/lib/format';
import type { ApiAddress, ApiTx } from '@/lib/types';

function CopyBtn({ text }: { text: string }) {
  const copy = () => navigator.clipboard?.writeText(text).catch(() => {});
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50 hover:text-white/80 transition"
      title="Copy"
    >
      copy
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="sm:w-44 shrink-0 text-sm text-white/45">{label}</div>
      <div className="flex-1 text-sm text-white break-all">{children}</div>
    </div>
  );
}

function StatusDot({ success }: { success: boolean }) {
  return (
    <span
      className={`inline-flex h-2 w-2 rounded-full shrink-0 ${success ? 'bg-emerald-400' : 'bg-red-400'}`}
      title={success ? 'Success' : 'Failed'}
    />
  );
}

export default function AddressPage() {
  const router = useRouter();
  const { address } = router.query;
  const addr = typeof address === 'string' ? address : '';

  const { data: account, loading: accountLoading, error: accountError } =
    useApi<ApiAddress>(addr ? `/address/${addr}` : null);

  const { data: txs, loading: txsLoading } =
    useApi<ApiTx[]>(addr ? `/address/${addr}/txs?limit=25` : null);

  if (accountLoading) {
    return (
      <div className="text-white animate-pulse space-y-4">
        <div className="h-8 rounded-2xl bg-white/10 w-1/3" />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <div className="text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <div className="text-lg font-medium text-red-300 mb-2">Address Not Found</div>
          <div className="text-sm text-white/50 mb-4">
            {accountError ?? 'This address has no indexed activity yet.'}
          </div>
          <Link href="/" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Address {truncateHash(account.address, 12, 6)} | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          <span className="text-white/70">Address</span>
        </div>

        <h1 className="text-2xl font-semibold mb-6">Address Details</h1>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Balance</div>
            <div className="text-xl font-semibold">
              {account.balance && account.balance !== '0' ? account.balance : '0 LITHO'}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Transactions</div>
            <div className="text-xl font-semibold">{formatNumber(account.txCount)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/45 mb-1">Last Active</div>
            <div className="text-xl font-semibold">
              {account.lastSeen ? timeAgo(account.lastSeen) : '—'}
            </div>
          </div>
        </div>

        {/* Detail card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-2 mb-8">
          <Row label="Address">
            <span className="font-mono">{account.address}</span>
            <CopyBtn text={account.address} />
          </Row>
          <Row label="Balance">
            <span className="font-mono">
              {account.balance && account.balance !== '0' ? account.balance : '0'}
            </span>
          </Row>
          <Row label="Transactions">
            {formatNumber(account.txCount)}
          </Row>
          {account.lastSeen && (
            <Row label="Last Active">
              {formatTimestamp(account.lastSeen)}
            </Row>
          )}
        </div>

        {/* Transactions */}
        <div>
          <div className="mb-4">
            <div className="text-sm text-white/55">Transaction History</div>
            <h2 className="text-xl font-semibold">Latest Transactions</h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1.8fr_0.8fr_1.4fr_1.4fr_1fr_0.7fr_0.8fr] gap-4 px-5 py-3 border-b border-white/10 text-xs font-medium text-white/40 uppercase tracking-wide">
              <div>Tx Hash</div>
              <div>Block</div>
              <div>From</div>
              <div>To</div>
              <div>Value</div>
              <div>Method</div>
              <div>Age</div>
            </div>

            {txsLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 px-5 py-4 border-b border-white/5 animate-pulse">
                    <div className="h-4 rounded bg-white/10 w-1/3" />
                    <div className="h-4 rounded bg-white/10 w-1/4" />
                    <div className="h-4 rounded bg-white/10 w-1/4" />
                  </div>
                ))}
              </div>
            ) : !txs || txs.length === 0 ? (
              <div className="py-16 text-center text-white/40">
                <div className="text-base font-medium mb-1">No transactions found</div>
                <div className="text-sm">This address has no indexed transactions yet.</div>
              </div>
            ) : (
              <div>
                {txs.map((tx) => (
                  <div
                    key={tx.hash}
                    className="grid grid-cols-1 md:grid-cols-[1.8fr_0.8fr_1.4fr_1.4fr_1fr_0.7fr_0.8fr] gap-3 md:gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/[0.03] transition"
                  >
                    {/* Hash */}
                    <div className="flex items-center gap-2">
                      <StatusDot success={tx.success} />
                      <Link
                        href={`/txs/${tx.hash}`}
                        className="font-mono text-sm text-emerald-300 hover:text-emerald-200 transition truncate"
                      >
                        {truncateHash(tx.hash)}
                      </Link>
                    </div>

                    {/* Block */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Block</span>
                      <Link
                        href={`/blocks/${tx.blockHeight}`}
                        className="font-mono text-sm text-white/80 hover:text-white transition"
                      >
                        #{formatNumber(tx.blockHeight)}
                      </Link>
                    </div>

                    {/* From */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">From</span>
                      <Link
                        href={`/address/${tx.fromAddr}`}
                        className={`font-mono text-sm transition truncate ${
                          tx.fromAddr === addr
                            ? 'text-white/50'
                            : 'text-emerald-300 hover:text-emerald-200'
                        }`}
                      >
                        {truncateHash(tx.fromAddr, 10, 6)}
                      </Link>
                    </div>

                    {/* To */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">To</span>
                      <Link
                        href={`/address/${tx.toAddr}`}
                        className={`font-mono text-sm transition truncate ${
                          tx.toAddr === addr
                            ? 'text-white/50'
                            : 'text-emerald-300 hover:text-emerald-200'
                        }`}
                      >
                        {tx.toAddr ? truncateHash(tx.toAddr, 10, 6) : '—'}
                      </Link>
                    </div>

                    {/* Value */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Value</span>
                      <span className="text-sm font-mono text-white/80">
                        {tx.value && tx.value !== '0' ? `${tx.value} ${tx.denom ?? 'ulitho'}` : '0'}
                      </span>
                    </div>

                    {/* Method */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Method</span>
                      {tx.method ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                          {tx.method}
                        </span>
                      ) : (
                        <span className="text-sm text-white/30">—</span>
                      )}
                    </div>

                    {/* Age */}
                    <div className="flex items-center md:block">
                      <span className="md:hidden text-xs text-white/40 mr-2 w-16 shrink-0">Age</span>
                      <span className="text-sm text-white/50">
                        {tx.timestamp ? timeAgo(tx.timestamp) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
