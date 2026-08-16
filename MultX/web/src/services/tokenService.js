import axios from 'axios';
import lithoLogo from '../assets/icons/litho-mark.png';
import { CHAIN_CONFIG, CosmosAPI } from '../config/api';
import { getLithoPrice } from './priceService';

const normalizeTokenRecord = (token) => ({
  id: token.id || (token.contractAddress ? token.contractAddress.toLowerCase() : 'native'),
  symbol: token.symbol || CHAIN_CONFIG.denom,
  name: token.name || 'Lithosphere',
  decimals: Number(token.decimals ?? CHAIN_CONFIG.decimals),
  totalSupply: token.totalSupply ?? token.total_supply ?? '',
  holders: token.holders ?? null,
  transfers: token.transfers ?? null,
  type: token.type || (token.contractAddress ? 'LEP100' : 'native'),
  contractAddress: token.contractAddress || null,
  priceUsd: token.priceUsd ?? null,
  logo: token.logo || lithoLogo
});

const buildNativeToken = async () => {
  const [supplyResponse, priceResponse] = await Promise.allSettled([
    axios.get(CosmosAPI.supplyByDenom(CHAIN_CONFIG.baseDenom)),
    getLithoPrice()
  ]);

  return normalizeTokenRecord({
    id: 'native',
    symbol: CHAIN_CONFIG.denom,
    name: 'Lithosphere',
    decimals: CHAIN_CONFIG.decimals,
    totalSupply:
      supplyResponse.status === 'fulfilled' ? supplyResponse.value?.data?.amount?.amount || '' : '',
    holders: null,
    transfers: null,
    type: 'native',
    contractAddress: null,
    priceUsd: priceResponse.status === 'fulfilled' ? priceResponse.value?.price ?? null : null,
    logo: lithoLogo
  });
};

export const fetchTokens = async () => {
  if (CHAIN_CONFIG.explorerDataApiUrl) {
    try {
      const { data } = await axios.get(`${CHAIN_CONFIG.explorerDataApiUrl}/tokens`);

      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeTokenRecord);
      }
    } catch (error) {
      console.warn('[tokenService] Falling back to native token catalog:', error.message);
    }
  }

  return [await buildNativeToken()];
};

export const fetchTokenDetail = async (tokenId) => {
  const normalizedId = String(tokenId || '').toLowerCase();

  if (normalizedId === 'native') {
    return buildNativeToken();
  }

  if (CHAIN_CONFIG.explorerDataApiUrl) {
    try {
      const tokens = await fetchTokens();
      return tokens.find((token) => token.id.toLowerCase() === normalizedId) || null;
    } catch (error) {
      console.warn('[tokenService] Failed to load token detail:', error.message);
    }
  }

  return null;
};
