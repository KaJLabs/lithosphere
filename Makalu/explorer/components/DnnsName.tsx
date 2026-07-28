import { isAddress } from 'ethers';
import { useEffect, useState } from 'react';


import { lookupAddress } from '@/lib/dnns';

export default function DnnsName({ address }: { address?: string | null }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setName(null);
    if (!address || !isAddress(address)) return () => { cancelled = true; };

    void lookupAddress(address).then((resolved) => {
      if (!cancelled) setName(resolved);
    });
    return () => { cancelled = true; };
  }, [address]);

  if (!name) return null;
  return (
    <div className="mt-2 inline-flex items-center rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-sm text-sky-200">
      {name}
    </div>
  );
}
