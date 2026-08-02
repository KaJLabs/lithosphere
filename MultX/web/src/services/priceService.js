// Module-level cache (NOT React state)
let cache = { price: null, lastUpdated: 0, currency: 'usd' };
const CACHE_TTL_MS = 60_000;
const LITHO_CG_ID = import.meta.env.VITE_LITHO_COINGECKO_ID || 'lithosphere';
const PRICE_OVERRIDE = import.meta.env.VITE_LITHO_PRICE_OVERRIDE
  ? parseFloat(import.meta.env.VITE_LITHO_PRICE_OVERRIDE)
  : null;

export async function getLithoPrice() {
  if (PRICE_OVERRIDE !== null && !isNaN(PRICE_OVERRIDE)) {
    return { price: PRICE_OVERRIDE, currency: 'usd', lastUpdated: Date.now() };
  }

  // Return cache if fresh
  if (cache.price !== null && Date.now() - cache.lastUpdated < CACHE_TTL_MS) {
    return { ...cache };
  }

  // Fetch from CoinGecko — returns null on any error, never throws
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${LITHO_CG_ID}&vs_currencies=usd`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const data = await res.json();
    cache = {
      price: data[LITHO_CG_ID]?.usd ?? null,
      currency: 'usd',
      lastUpdated: Date.now()
    };
  } catch (err) {
    console.warn('[priceService] Failed to fetch price:', err.message);
    cache = { price: null, currency: 'usd', lastUpdated: Date.now() };
  }

  return { ...cache };
}

export function formatUsdValue(amount, price) {
  if (!price || isNaN(amount) || amount <= 0) return null;

  const usd = parseFloat(amount) * price;
  if (usd < 0.01) return '< $0.01';

  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
