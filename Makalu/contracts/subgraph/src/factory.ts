/* eslint-disable prefer-const */
import { Address } from '@graphprotocol/graph-ts';
import { PairCreated } from '../generated/LithoswapV2Factory/LithoswapV2Factory';
import { LithoswapFactory, Pair, Token } from '../generated/schema';
import { LithoswapV2Pair as PairTemplate } from '../generated/templates';
import {
  ONE_BI,
  ZERO_BD,
  ZERO_BI,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
} from './helpers';

// Factory address is read from the event, so no constant is hardcoded here.
function loadOrCreateFactory(address: string): LithoswapFactory {
  let factory = LithoswapFactory.load(address);
  if (factory === null) {
    factory = new LithoswapFactory(address);
    factory.pairCount = 0;
    factory.txCount = ZERO_BI;
    factory.totalVolumeToken = ZERO_BD;
  }
  return factory as LithoswapFactory;
}

function loadOrCreateToken(address: string): Token {
  let token = Token.load(address);
  if (token === null) {
    let addr = Address.fromString(address);
    token = new Token(address);
    token.symbol = fetchTokenSymbol(addr);
    token.name = fetchTokenName(addr);
    token.decimals = fetchTokenDecimals(addr);
    token.totalSupply = fetchTokenTotalSupply(addr);
    token.tradeVolume = ZERO_BD;
    token.txCount = ZERO_BI;
    token.totalLiquidity = ZERO_BD;
  }
  return token as Token;
}

export function handleNewPair(event: PairCreated): void {
  let factory = loadOrCreateFactory(event.address.toHexString());
  factory.pairCount = factory.pairCount + 1;
  factory.txCount = factory.txCount.plus(ONE_BI);

  let token0 = loadOrCreateToken(event.params.token0.toHexString());
  let token1 = loadOrCreateToken(event.params.token1.toHexString());
  token0.save();
  token1.save();

  let pair = new Pair(event.params.pair.toHexString());
  pair.token0 = token0.id;
  pair.token1 = token1.id;
  pair.reserve0 = ZERO_BD;
  pair.reserve1 = ZERO_BD;
  pair.totalSupply = ZERO_BD;
  pair.token0Price = ZERO_BD;
  pair.token1Price = ZERO_BD;
  pair.volumeToken0 = ZERO_BD;
  pair.volumeToken1 = ZERO_BD;
  pair.txCount = ZERO_BI;
  pair.createdAtTimestamp = event.block.timestamp;
  pair.createdAtBlockNumber = event.block.number;
  pair.save();

  // Start indexing the new pair's events.
  PairTemplate.create(event.params.pair);

  factory.save();
}
