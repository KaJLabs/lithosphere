import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import { formatNumber, formatTimestamp, truncateHash, timeAgo, cleanMethod, txTypeInfo, isEvmAddress, isBech32Address } from '@/lib/format';
import type { ApiTx, StatsSummary } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Utility components                                                 */
/* ------------------------------------------------------------------ */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50 hover:text-white/80 transition"
      title="Copy to clipboard"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3.5 border-b border-white/5 last:border-0">
      <div className="sm:w-40 shrink-0 text-sm text-white/45">{label}</div>
      <div className="flex-1 text-sm text-white break-all">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Raw log events parser                                              */
/* ------------------------------------------------------------------ */

interface LogEvent {
  type: string;
  attributes: { key: string; value: string }[];
}

function parseRawLog(rawLog: string | undefined): LogEvent[] | null {
  if (!rawLog) return null;
  try {
    const parsed = JSON.parse(rawLog);
    // Cosmos SDK format: [{ events: [...] }] or { events: [...] }
    const events: LogEvent[] = Array.isArray(parsed)
      ? parsed.flatMap((entry: { events?: LogEvent[] }) => entry.events ?? [])
      : parsed.events ?? [];
    return events.length > 0 ? events : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TransactionDetailPage() {
  const router = useRouter();
  const { hash } = router.query;
  const [inputExpanded, setInputExpanded] = useState(false);
  const [rightTab, setRightTab] = useState<'overview' | 'events'>('overview');

  const { data: tx, loading, error } = useApi<ApiTx>(
    hash ? `/txs/${hash}` : null,
  );
  const { data: stats } = useApi<StatsSummary>('/stats/summary');

  const tipHeight = stats?.tipHeight ?? 0;
  const confirmations = tx && tipHeight ? tipHeight - tx.blockHeight + 1 : 0;

  /* ---------- loading state ---------- */
  if (loading) {
    return (
      <div className="text-white animate-pulse space-y-4">
        <div className="h-8 rounded-2xl bg-white/10 w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/10 w-full" />
            ))}
          </div>
          <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- error / not found ---------- */
  if (error || !tx) {
    return (
      <div className="text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <div className="text-lg font-medium text-red-300 mb-2">Transaction Not Found</div>
          <div className="text-sm text-white/50 mb-4">
            {error ?? 'No transaction found with this hash.'}
          </div>
          <Link href="/txs" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Transactions
          </Link>
        </div>
      </div>
    );
  }

  /* ---------- derived data ---------- */
  const gasUsed = tx.gasUsed ? Number(tx.gasUsed) : null;
  const gasWanted = tx.gasWanted ? Number(tx.gasWanted) : null;
  const gasPercent =
    gasUsed != null && gasWanted ? ((gasUsed / gasWanted) * 100).toFixed(2) : null;
  const logEvents = parseRawLog(tx.rawLog);
  const receiptHref = `/receipt/${tx.evmHash || tx.hash}`;

  return (
    <>
      <Head>
        <title>Tx {truncateHash(tx.hash)} | {EXPLORER_TITLE}</title>
      </Head>

      <div className="text-white">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link href="/" className="hover:text-white/70 transition">Home</Link>
          <span>/</span>
          <Link href="/txs" className="hover:text-white/70 transition">Transactions</Link>
          <span>/</span>
          <span className="text-white/70 font-mono">{truncateHash(tx.hash)}</span>
        </div>

        {/* ============================================================ */}
        {/*  TWO-PANEL LAYOUT                                            */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ---------------------------------------------------------- */}
          {/*  LEFT PANEL: Transaction summary                            */}
          {/* ---------------------------------------------------------- */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold mb-5">Transaction</h2>

            {/* Status */}
            <InfoRow label="Status">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                  tx.success
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                    : 'border-red-400/20 bg-red-400/10 text-red-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tx.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {tx.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </InfoRow>

            {/* Hash */}
            <InfoRow label="Hash">
              <span className="font-mono">{truncateHash(tx.hash, 14)}</span>
              <CopyBtn text={tx.hash} />
            </InfoRow>

            {/* EVM Hash (if different) */}
            {tx.evmHash && tx.evmHash !== tx.hash && (
              <InfoRow label="EVM Hash">
                <span className="font-mono">{truncateHash(tx.evmHash, 14)}</span>
                <CopyBtn text={tx.evmHash} />
              </InfoRow>
            )}

            {/* Block */}
            <InfoRow label="Block">
              <Link
                href={`/blocks/${tx.blockHeight}`}
                className="font-mono text-emerald-300 hover:text-emerald-200 transition"
              >
                #{formatNumber(tx.blockHeight)}
              </Link>
              {confirmations > 0 && (
                <span className="ml-2 text-xs text-white/40">
                  ({formatNumber(confirmations)} confirmations)
                </span>
              )}
            </InfoRow>

            {/* Time */}
            {tx.timestamp && (
              <InfoRow label="Time">
                <span className="text-white/70 text-xs">{timeAgo(tx.timestamp)}</span>
                <span className="ml-2 text-white/30 text-xs">({formatTimestamp(tx.timestamp)})</span>
              </InfoRow>
            )}

            {/* From */}
            <InfoRow label="From">
              {tx.fromAddr ? (
                <div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link
                      href={`/address/${tx.fromAddr}`}
                      className="font-mono text-emerald-300 hover:text-emerald-200 transition"
                    >
                      {truncateHash(tx.fromAddr, 10)}
                    </Link>
                    <CopyBtn text={tx.fromAddr} />
                  </div>
                  {/* Show alternate address format */}
                  {tx.evmFromAddr && tx.evmFromAddr !== tx.fromAddr && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <Link
                        href={`/address/${tx.evmFromAddr}`}
                        className="font-mono text-xs text-white/45 hover:text-emerald-300 transition"
                      >
                        {truncateHash(tx.evmFromAddr, 10)}
                      </Link>
                      <CopyBtn text={tx.evmFromAddr} />
                    </div>
                  )}
                  {tx.cosmosFromAddr && tx.cosmosFromAddr !== tx.fromAddr && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <Link
                        href={`/address/${tx.cosmosFromAddr}`}
                        className="font-mono text-xs text-white/45 hover:text-emerald-300 transition"
                      >
                        {truncateHash(tx.cosmosFromAddr, 10)}
                      </Link>
                      <CopyBtn text={tx.cosmosFromAddr} />
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-white/40">&mdash;</span>
              )}
            </InfoRow>

            {/* To */}
            <InfoRow label="To">
              {tx.toAddr ? (
                <div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link
                      href={`/address/${tx.toAddr}`}
                      className="font-mono text-emerald-300 hover:text-emerald-200 transition"
                    >
                      {truncateHash(tx.toAddr, 10)}
                    </Link>
                    <CopyBtn text={tx.toAddr} />
                  </div>
                  {/* Show alternate address format */}
                  {tx.evmToAddr && tx.evmToAddr !== tx.toAddr && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <Link
                        href={`/address/${tx.evmToAddr}`}
                        className="font-mono text-xs text-white/45 hover:text-emerald-300 transition"
                      >
                        {truncateHash(tx.evmToAddr, 10)}
                      </Link>
                      <CopyBtn text={tx.evmToAddr} />
                    </div>
                  )}
                  {tx.cosmosToAddr && tx.cosmosToAddr !== tx.toAddr && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <Link
                        href={`/address/${tx.cosmosToAddr}`}
                        className="font-mono text-xs text-white/45 hover:text-emerald-300 transition"
                      >
                        {truncateHash(tx.cosmosToAddr, 10)}
                      </Link>
                      <CopyBtn text={tx.cosmosToAddr} />
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-white/40">&mdash;</span>
              )}
            </InfoRow>

            {/* Contract created */}
            {tx.contractAddress && (
              <InfoRow label="Contract">
                <Link
                  href={`/address/${tx.contractAddress}`}
                  className="font-mono text-emerald-300 hover:text-emerald-200 transition"
                >
                  {truncateHash(tx.contractAddress, 10)}
                </Link>
                <CopyBtn text={tx.contractAddress} />
              </InfoRow>
            )}

            {/* Receipt link */}
            <InfoRow label="Receipt">
              <Link
                href={receiptHref}
                className="text-emerald-300 hover:text-emerald-200 transition text-sm"
              >
                View Receipt &rarr;
              </Link>
            </InfoRow>
          </div>

          {/* ---------------------------------------------------------- */}
          {/*  RIGHT PANEL: Overview details                              */}
          {/* ---------------------------------------------------------- */}
          <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-white/5">
            {/* Tab header */}
            <div className="border-b border-white/10 px-6 pt-5 pb-0 flex gap-6">
              <button
                onClick={() => setRightTab('overview')}
                className={`pb-3 text-sm font-medium transition ${
                  rightTab === 'overview'
                    ? 'border-b-2 border-emerald-400 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setRightTab('events')}
                className={`pb-3 text-sm font-medium transition ${
                  rightTab === 'events'
                    ? 'border-b-2 border-emerald-400 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Events
              </button>
            </div>

            <div className="px-6 py-2">
              {/* ---- Overview tab content ---- */}
              {rightTab === 'overview' && (
                <>
                  {/* Value */}
                  <InfoRow label="Value">
                    <span className="font-mono">
                      {tx.value && tx.value !== '0'
                        ? `${tx.value} ${tx.denom ?? 'ulitho'}`
                        : '0'}
                    </span>
                  </InfoRow>

                  {/* Transaction Fee */}
                  <InfoRow label="Transaction Fee">
                    <span className="font-mono">
                      {tx.feePaid && tx.feePaid !== '0'
                        ? `${tx.feePaid} ${tx.denom ?? 'ulitho'}`
                        : '0'}
                    </span>
                  </InfoRow>

                  {/* Gas Used */}
                  {(gasUsed != null || gasWanted != null) && (
                    <InfoRow label="Gas Used">
                      <span className="font-mono">
                        {gasUsed != null ? formatNumber(gasUsed) : '---'}
                        {' / '}
                        {gasWanted != null ? formatNumber(gasWanted) : '---'}
                      </span>
                      {gasPercent && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                          {gasPercent}%
                        </span>
                      )}
                    </InfoRow>
                  )}

                  {/* Gas Price */}
                  {tx.gasPrice && (
                    <InfoRow label="Gas Price">
                      <span className="font-mono">{tx.gasPrice} ulitho</span>
                    </InfoRow>
                  )}

                  {/* Nonce */}
                  {tx.nonce != null && (
                    <InfoRow label="Nonce">
                      <span className="font-mono">{tx.nonce}</span>
                    </InfoRow>
                  )}

                  {/* Transaction Type */}
                  <InfoRow label="Transaction Type">
                    {(() => {
                      const info = txTypeInfo(tx.txType);
                      return (
                        <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${info.color}`}>
                          {info.label}
                        </span>
                      );
                    })()}
                    {tx.method && (
                      <span className="ml-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs font-mono text-white/50">
                        {cleanMethod(tx.method)}
                      </span>
                    )}
                  </InfoRow>

                  {/* Memo */}
                  {tx.memo && (
                    <InfoRow label="Memo">
                      <span className="text-white/70">{tx.memo}</span>
                    </InfoRow>
                  )}

                  {/* Input Data (collapsible) */}
                  {tx.inputData && tx.inputData !== '0x' && (
                    <div className="py-3.5 border-b border-white/5 last:border-0">
                      <button
                        onClick={() => setInputExpanded((v) => !v)}
                        className="flex items-center gap-2 text-sm text-white/45 hover:text-white/70 transition w-full text-left"
                      >
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${inputExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        Input Data
                      </button>
                      {inputExpanded && (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/60 max-h-60 overflow-auto whitespace-pre-wrap">
                          {tx.inputData}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ---- Events tab content ---- */}
              {rightTab === 'events' && (
                <>
                  {logEvents && logEvents.length > 0 ? (
                    <div className="py-3.5">
                      <div className="text-sm text-white/45 mb-3">
                        {logEvents.length} event{logEvents.length !== 1 ? 's' : ''} emitted
                      </div>
                      <div className="space-y-2">
                        {logEvents.map((evt, idx) => (
                          <div
                            key={idx}
                            className="rounded-2xl border border-white/10 bg-black/20 p-3"
                          >
                            <div className="text-xs font-medium text-emerald-300 mb-1.5">
                              {evt.type}
                            </div>
                            <div className="space-y-1">
                              {evt.attributes.map((attr, aidx) => (
                                <div key={aidx} className="flex gap-2 text-xs">
                                  <span className="text-white/40 shrink-0">{attr.key}:</span>
                                  <span className="font-mono text-white/60 break-all">{attr.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="text-sm text-white/40">No parsed events available.</div>
                      {tx.rawLog && (
                        <div className="mt-4 text-left">
                          <div className="text-sm text-white/45 mb-2">Raw Log</div>
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/60 max-h-60 overflow-auto whitespace-pre-wrap">
                            {tx.rawLog}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
