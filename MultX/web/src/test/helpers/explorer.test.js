import { Buffer } from 'node:buffer';
import {
  computeTxHash,
  detectAddressType,
  extractFee,
  extractTxAmount,
  extractTxParticipants,
  formatGasPrice,
  formatTokenAmount,
  hexToDecimalString,
  normalizeTxHash,
  parseHexNumber,
  toEvmHash
} from '../../helpers/explorer';
import {
  accountAddress,
  buildTxResponse,
  evmAddress,
  txHash
} from '../fixtures/explorerFixtures';

describe('explorer helpers', () => {
  it('detects Kamet address formats', () => {
    expect(detectAddressType(evmAddress)).toBe('EVM');
    expect(detectAddressType(accountAddress)).toBe('COSMOS');
    expect(detectAddressType('not-an-address')).toBe('');
  });

  it('normalizes tx hashes for Cosmos and EVM views', () => {
    expect(normalizeTxHash(`0x${txHash.toLowerCase()}`)).toBe(txHash);
    expect(toEvmHash(txHash)).toBe(`0x${txHash.toLowerCase()}`);
  });

  it('parses hexadecimal numbers and wei values from EVM RPC responses', () => {
    expect(parseHexNumber('0x10')).toBe(16);
    expect(parseHexNumber('nope')).toBe(0);
    expect(hexToDecimalString('0xde0b6b3a7640000')).toBe('1000000000000000000');
  });

  it('formats token amounts with 18 decimals', () => {
    expect(formatTokenAmount('123450000000000000000')).toBe('123.45');
    expect(formatTokenAmount('0')).toBe('0');
    expect(formatTokenAmount('abc')).toBe('--');
  });

  it('formats EVM gas prices and fees in Strat (1 Strat = 100 base units)', () => {
    // eth_gasPrice=7 → 7/100 = 0.07 Strat
    expect(formatGasPrice('7', 'strat')).toBe('0.07 Strat');
    expect(formatGasPrice('0x7', 'strat')).toBe('0.07 Strat');
    // gasUsed × gasPrice = 21000 × 7 = 147000 base units = 1,470 Strat
    expect(formatGasPrice('147000', 'strat')).toBe('1,470 Strat');
    // 100 base = exactly 1 Strat
    expect(formatGasPrice('100', 'strat')).toBe('1 Strat');
  });

  it('extracts transaction participants, amount, and fee from tx responses', () => {
    const txResponse = buildTxResponse();
    expect(extractTxParticipants(txResponse)).toEqual({
      from: accountAddress,
      to: 'litho1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2sr89k'
    });
    expect(extractTxAmount(txResponse)).toContain('LITHO');
    const feeOutput = extractFee(txResponse);
    expect(feeOutput === '--' || /Strat$/.test(feeOutput)).toBe(true);
  });

  it('computes deterministic tx hashes from base64 payloads', async () => {
    expect(await computeTxHash(Buffer.from('kamet-tx-alpha').toString('base64'))).toBe(txHash);
  });
});
