import { useState, useEffect } from 'react';

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  transactions: string[];
}

export default function Explorer() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [chainId, setChainId] = useState<string>('');
  const [blockNumber, setBlockNumber] = useState<string>('0');
  const [error, setError] = useState<string>('');

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545';
  const configuredChainId = process.env.NEXT_PUBLIC_CHAIN_ID || '777777';
  const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Litho Devnet';
  const title = process.env.NEXT_PUBLIC_EXPLORER_TITLE || 'Lithosphere Devnet Explorer';

  async function rpc(method: string, params: unknown[] = []) {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  }

  async function fetchLatest() {
    try {
      const cid = await rpc('eth_chainId');
      setChainId(String(parseInt(cid, 16)));

      const bn = await rpc('eth_blockNumber');
      const num = parseInt(bn, 16);
      setBlockNumber(String(num));

      const fetched: Block[] = [];
      const start = Math.max(0, num - 9);
      for (let i = num; i >= start; i--) {
        const block = await rpc('eth_getBlockByNumber', [`0x${i.toString(16)}`, false]);
        if (block) {
          fetched.push({
            number: String(parseInt(block.number, 16)),
            hash: block.hash,
            timestamp: new Date(parseInt(block.timestamp, 16) * 1000).toLocaleString(),
            transactions: block.transactions || [],
          });
        }
      }
      setBlocks(fetched);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to connect to chain');
    }
  }

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: 8 }}>{title}</h1>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Chain Name" value={chainName} />
        <Stat label="Chain ID" value={chainId || configuredChainId} />
        <Stat label="Latest Block" value={`#${blockNumber}`} />
        <Stat label="RPC" value={rpcUrl} />
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #c00', padding: 12, borderRadius: 4, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <h2>Recent Blocks</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
            <th style={th}>Block</th>
            <th style={th}>Timestamp</th>
            <th style={th}>Txns</th>
            <th style={th}>Hash</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.hash} style={{ borderBottom: '1px solid #eee' }}>
              <td style={td}>{b.number}</td>
              <td style={td}>{b.timestamp}</td>
              <td style={td}>{b.transactions.length}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                {b.hash.slice(0, 18)}...{b.hash.slice(-6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {blocks.length === 0 && !error && <p style={{ opacity: 0.6 }}>Waiting for blocks...</p>}

      <button onClick={fetchLatest} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
        Refresh
      </button>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8f8f8', padding: '12px 20px', borderRadius: 6, minWidth: 140 }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
