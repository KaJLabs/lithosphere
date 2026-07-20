/* eslint-disable prefer-const */
import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  Sync,
  Swap as SwapEvent,
  Mint as MintEvent,
  Burn as BurnEvent,
  LithoswapV2Pair as PairContract,
} from '../generated/templates/LithoswapV2Pair/LithoswapV2Pair';
import { Pair, Token, Transaction, Swap, Mint, Burn } from '../generated/schema';
import {
  ONE_BI,
  ZERO_BD,
  convertTokenToDecimal,
  updatePairDayData,
  updateTokenDayData,
} from './helpers';

function loadOrCreateTransaction(event: ethereum.Event): Transaction {
  let id = event.transaction.hash.toHexString();
  let tx = Transaction.load(id);
  if (tx === null) {
    tx = new Transaction(id);
    tx.blockNumber = event.block.number;
    tx.timestamp = event.block.timestamp;
    tx.save();
  }
  return tx as Transaction;
}

export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHexString());
  if (pair === null) return;
  let token0 = Token.load(pair.token0)!;
  let token1 = Token.load(pair.token1)!;

  // Roll the old reserves out of each token's pooled total before overwriting.
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1);

  pair.token0Price = pair.reserve0.gt(ZERO_BD) ? pair.reserve1.div(pair.reserve0) : ZERO_BD;
  pair.token1Price = pair.reserve1.gt(ZERO_BD) ? pair.reserve0.div(pair.reserve1) : ZERO_BD;

  let contract = PairContract.bind(event.address);
  let supply = contract.try_totalSupply();
  if (!supply.reverted) {
    pair.totalSupply = convertTokenToDecimal(supply.value, BigInt.fromI32(18));
  }

  token0.save();
  token1.save();
  pair.save();
}

export function handleSwap(event: SwapEvent): void {
  let pair = Pair.load(event.address.toHexString());
  if (pair === null) return;
  let token0 = Token.load(pair.token0)!;
  let token1 = Token.load(pair.token1)!;

  let amount0In = convertTokenToDecimal(event.params.amount0In, token0.decimals);
  let amount1In = convertTokenToDecimal(event.params.amount1In, token1.decimals);
  let amount0Out = convertTokenToDecimal(event.params.amount0Out, token0.decimals);
  let amount1Out = convertTokenToDecimal(event.params.amount1Out, token1.decimals);
  let amount0Total = amount0In.plus(amount0Out);
  let amount1Total = amount1In.plus(amount1Out);

  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total);
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total);
  pair.txCount = pair.txCount.plus(ONE_BI);

  token0.tradeVolume = token0.tradeVolume.plus(amount0Total);
  token1.tradeVolume = token1.tradeVolume.plus(amount1Total);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  token0.save();
  token1.save();
  pair.save();

  let tx = loadOrCreateTransaction(event);
  let swap = new Swap(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  );
  swap.transaction = tx.id;
  swap.timestamp = event.block.timestamp;
  swap.pair = pair.id;
  swap.sender = event.params.sender;
  swap.from = event.transaction.from;
  swap.to = event.params.to;
  swap.amount0In = amount0In;
  swap.amount1In = amount1In;
  swap.amount0Out = amount0Out;
  swap.amount1Out = amount1Out;
  swap.save();

  let pdd = updatePairDayData(event);
  pdd.dailyVolumeToken0 = pdd.dailyVolumeToken0.plus(amount0Total);
  pdd.dailyVolumeToken1 = pdd.dailyVolumeToken1.plus(amount1Total);
  pdd.save();

  let t0dd = updateTokenDayData(token0, event);
  t0dd.dailyVolumeToken = t0dd.dailyVolumeToken.plus(amount0Total);
  t0dd.save();

  let t1dd = updateTokenDayData(token1, event);
  t1dd.dailyVolumeToken = t1dd.dailyVolumeToken.plus(amount1Total);
  t1dd.save();
}

export function handleMint(event: MintEvent): void {
  let pair = Pair.load(event.address.toHexString());
  if (pair === null) return;
  let token0 = Token.load(pair.token0)!;
  let token1 = Token.load(pair.token1)!;

  let tx = loadOrCreateTransaction(event);
  let mint = new Mint(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  );
  mint.transaction = tx.id;
  mint.timestamp = event.block.timestamp;
  mint.pair = pair.id;
  mint.sender = event.params.sender;
  mint.amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  mint.amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);
  mint.save();

  pair.txCount = pair.txCount.plus(ONE_BI);
  pair.save();
}

export function handleBurn(event: BurnEvent): void {
  let pair = Pair.load(event.address.toHexString());
  if (pair === null) return;
  let token0 = Token.load(pair.token0)!;
  let token1 = Token.load(pair.token1)!;

  let tx = loadOrCreateTransaction(event);
  let burn = new Burn(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  );
  burn.transaction = tx.id;
  burn.timestamp = event.block.timestamp;
  burn.pair = pair.id;
  burn.sender = event.params.sender;
  burn.to = event.params.to;
  burn.amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
  burn.amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);
  burn.save();

  pair.txCount = pair.txCount.plus(ONE_BI);
  pair.save();
}
