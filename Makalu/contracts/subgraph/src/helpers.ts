/* eslint-disable prefer-const */
import { BigInt, BigDecimal, Address, ethereum } from '@graphprotocol/graph-ts';
import { ERC20 } from '../generated/LithoswapV2Factory/ERC20';
import { Pair, PairDayData, Token, TokenDayData } from '../generated/schema';

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = ONE_BD;
  for (let i = ZERO_BI; i.lt(decimals); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'));
  }
  return bd;
}

/** Scale a raw token amount by its decimals into a human BigDecimal. */
export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) return tokenAmount.toBigDecimal();
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let result = contract.try_symbol();
  return result.reverted ? 'unknown' : result.value;
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let result = contract.try_name();
  return result.reverted ? 'unknown' : result.value;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let result = contract.try_decimals();
  return result.reverted ? BigInt.fromI32(18) : BigInt.fromI32(result.value);
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let result = contract.try_totalSupply();
  return result.reverted ? ZERO_BI : result.value;
}

/** Load-or-create today's PairDayData, refreshing reserves and bumping the txn
 *  counter. The caller adds volume and saves. */
export function updatePairDayData(event: ethereum.Event): PairDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStart = dayID * 86400;
  let id = event.address.toHexString().concat('-').concat(BigInt.fromI32(dayID).toString());
  let pair = Pair.load(event.address.toHexString())!;

  let data = PairDayData.load(id);
  if (data === null) {
    data = new PairDayData(id);
    data.date = dayStart;
    data.pair = pair.id;
    data.token0 = pair.token0;
    data.token1 = pair.token1;
    data.dailyVolumeToken0 = ZERO_BD;
    data.dailyVolumeToken1 = ZERO_BD;
    data.dailyTxns = ZERO_BI;
  }
  data.reserve0 = pair.reserve0;
  data.reserve1 = pair.reserve1;
  data.dailyTxns = data.dailyTxns.plus(ONE_BI);
  return data as PairDayData;
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStart = dayID * 86400;
  let id = token.id.concat('-').concat(BigInt.fromI32(dayID).toString());

  let data = TokenDayData.load(id);
  if (data === null) {
    data = new TokenDayData(id);
    data.date = dayStart;
    data.token = token.id;
    data.dailyVolumeToken = ZERO_BD;
    data.dailyTxns = ZERO_BI;
  }
  data.totalLiquidityToken = token.totalLiquidity;
  data.dailyTxns = data.dailyTxns.plus(ONE_BI);
  return data as TokenDayData;
}
