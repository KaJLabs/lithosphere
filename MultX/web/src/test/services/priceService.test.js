describe('priceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    // Hermetic: ignore any local .env VITE_LITHO_PRICE_OVERRIDE so the cache /
    // fetch behaviour is what's under test, not a pinned display price.
    vi.stubEnv('VITE_LITHO_PRICE_OVERRIDE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('caches successful price lookups', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        lithosphere: {
          usd: 0.25
        }
      })
    });

    globalThis.fetch = fetchMock;

    const { getLithoPrice } = await import('../../services/priceService');
    const first = await getLithoPrice();
    const second = await getLithoPrice();

    expect(first.price).toBe(0.25);
    expect(second.price).toBe(0.25);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('formats USD values consistently', async () => {
    const { formatUsdValue } = await import('../../services/priceService');
    expect(formatUsdValue(10, 0.25)).toBe('$2.50');
    expect(formatUsdValue(0.0001, 0.25)).toBe('< $0.01');
    expect(formatUsdValue(10, null)).toBeNull();
  });
});
