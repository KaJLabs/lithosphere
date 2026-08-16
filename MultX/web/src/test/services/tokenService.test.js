import axios from 'axios';
import { getLithoPrice } from '../../services/priceService';
import { fetchTokenDetail, fetchTokens } from '../../services/tokenService';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../../services/priceService', () => ({
  getLithoPrice: vi.fn().mockResolvedValue({ price: 0.25 })
}));

vi.mock('../../config/api', () => ({
  CHAIN_CONFIG: {
    denom: 'LITHO',
    decimals: 18,
    baseDenom: 'ulitho',
    explorerDataApiUrl: 'https://explorer-data.test'
  },
  CosmosAPI: {
    supplyByDenom: () => 'https://api-3.litho.ai/cosmos/bank/v1beta1/supply/by_denom?denom=ulitho'
  }
}));

describe('tokenService', () => {
  beforeEach(() => {
    axios.get.mockReset();
    getLithoPrice.mockClear();
  });

  it('returns normalized token records from the explorer data api when available', async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        {
          id: '0xabc',
          symbol: 'LITHO',
          name: 'Lithosphere',
          decimals: 18,
          total_supply: '1000000000000000000000',
          holders: 2,
          transfers: 5,
          contractAddress: '0xabc',
          type: 'LEP100'
        }
      ]
    });

    const tokens = await fetchTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      id: '0xabc',
      holders: 2,
      transfers: 5,
      contractAddress: '0xabc'
    });
  });

  it('falls back to the native token snapshot when token indexing is unavailable', async () => {
    axios.get
      .mockRejectedValueOnce(new Error('token index unavailable'))
      .mockResolvedValueOnce({
        data: {
          amount: {
            amount: '1000000000000000000000'
          }
        }
      });

    const tokens = await fetchTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      id: 'native',
      symbol: 'LITHO',
      totalSupply: '1000000000000000000000',
      priceUsd: 0.25
    });
  });

  it('loads native token detail directly without querying the explorer api', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        amount: {
          amount: '1000000000000000000000'
        }
      }
    });

    const token = await fetchTokenDetail('native');
    expect(token).toMatchObject({
      id: 'native',
      symbol: 'LITHO'
    });
  });
});
