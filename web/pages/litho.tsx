import { useState } from 'react';

export default function Litho() {
  const [addr, setAddr] = useState('');
  const [bal, setBal] = useState<string|undefined>();

  async function fetchBal() {
    const r = await fetch(`/api/litho/balance/${addr}`);
    const j = await r.json();
    setBal(j.balance);
  }

  return (
    <main style={{padding:24,fontFamily:'system-ui'}}>
      <h1>LITHO (id=0) Demo</h1>
      <input placeholder="0xYourAddress" value={addr} onChange={(e)=>setAddr(e.target.value)} style={{width:'60%'}} />
      <button onClick={fetchBal} style={{marginLeft:12}}>Check Balance</button>
      {bal !== undefined && <p>Balance: {bal}</p>}
      <p style={{opacity:.7}}>This page demonstrates LEP100 id=0 integration. Replace with real RPC/indexer calls.</p>
    </main>
  );
}
