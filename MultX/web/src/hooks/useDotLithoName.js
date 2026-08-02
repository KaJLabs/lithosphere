import { useEffect, useState } from 'react';
import { getNamesByAddress } from '../services/namesService';

// Module-level memoization cache: address (lowercased) → name | null.
// Survives across components and re-renders so a tx detail page that shows
// the same address as the address page doesn't refetch.
const cache = new Map();

/**
 * Reverse-resolve a 0x... address to its .litho name. Returns the name
 * (e.g. "team.litho") if a reverse record is set on the Kamet
 * ReverseRegistrar, otherwise null. Fetches are best-effort and silently
 * fail; consumers should render the raw address when the hook returns null.
 *
 * @param {string|null|undefined} address — 0x-hex EVM address
 * @returns {string|null} the .litho name or null
 */
export function useDotLithoName(address) {
  const [name, setName] = useState(() => {
    if (!address) return null;
    const cached = cache.get(address.toLowerCase());
    return cached === undefined ? null : cached;
  });

  useEffect(() => {
    if (!address) { setName(null); return; }
    const key = address.toLowerCase();
    if (cache.has(key)) {
      setName(cache.get(key));
      return;
    }
    let cancelled = false;
    getNamesByAddress(address)
      .then((resolved) => {
        if (cancelled) return;
        cache.set(key, resolved || null);
        setName(resolved || null);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(key, null);
        setName(null);
      });
    return () => { cancelled = true; };
  }, [address]);

  return name;
}
