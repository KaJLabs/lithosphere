import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';

import { MultXClient } from '../src/index.js';
import {
  KAMET_MAINNET,
  KAMET_BRIDGE_ADDRESS,
  KAMET_SUPPORTED_TOKENS,
  KAMET_DESTINATION_CHAINS,
  KAMET_CHAIN_ID,
  MAKALU_TESTNET,
  MAKALU_BRIDGE_ADDRESS,
  MAKALU_SUPPORTED_TOKENS,
  MAKALU_DESTINATION_CHAINS,
  MAKALU_CHAIN_ID,
} from '../src/presets/index.js';

describe('Kamet preset', () => {
  it('points at the canonical hardened bridge', () => {
    expect(KAMET_BRIDGE_ADDRESS).toBe(
      '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263',
    );
    expect(KAMET_CHAIN_ID).toBe(900523);
    expect(KAMET_MAINNET.bridgeApiUrl).toBe('https://bridge.litho.ai');
  });

  it('lists all 11 supported tokens with valid, checksummed, 18-decimal addresses', () => {
    expect(KAMET_SUPPORTED_TOKENS).toHaveLength(11);
    for (const t of KAMET_SUPPORTED_TOKENS) {
      expect(ethers.utils.isAddress(t.address)).toBe(true);
      // addresses are stored checksummed
      expect(ethers.utils.getAddress(t.address)).toBe(t.address);
      expect(t.decimals).toBe(18);
      expect(t.symbol).toMatch(/^[A-Za-z]+$/);
    }
    const symbols = KAMET_SUPPORTED_TOKENS.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length); // no dupes
    expect(symbols).toContain('wLITHO');
    expect(symbols).toContain('FGPT');
    expect(symbols).toContain('QTT');
  });

  it('never targets the Kamet source chain as a destination', () => {
    for (const c of KAMET_DESTINATION_CHAINS) {
      expect(c.chainId).not.toBe(KAMET_CHAIN_ID);
    }
    expect(KAMET_DESTINATION_CHAINS.map((c) => c.chainId)).toEqual([
      11155111, 84532, 97,
    ]);
  });

  it('constructs a ready MultXClient with no extra config', () => {
    const client = new MultXClient(KAMET_MAINNET);
    expect(client.isContractDeployed()).toBe(true);
    expect(client.bridgeAddress).toBe(KAMET_BRIDGE_ADDRESS);
    expect(client.supportedTokens).toHaveLength(11);
  });
});

describe('Makalu preset', () => {
  it('points at the deployed Makalu bridge on 700777', () => {
    expect(MAKALU_BRIDGE_ADDRESS).toBe(
      '0x5832D5E609c6690f74c7683606Eb20F89ff096a6',
    );
    expect(MAKALU_CHAIN_ID).toBe(700777);
    expect(MAKALU_TESTNET.bridgeApiUrl).toBe('https://bridge.litho.ai');
  });

  it('lists 10 supported tokens (no QTT) with valid checksummed 18-decimal addresses', () => {
    expect(MAKALU_SUPPORTED_TOKENS).toHaveLength(10);
    for (const t of MAKALU_SUPPORTED_TOKENS) {
      expect(ethers.utils.isAddress(t.address)).toBe(true);
      expect(ethers.utils.getAddress(t.address)).toBe(t.address);
      expect(t.decimals).toBe(18);
    }
    const symbols = MAKALU_SUPPORTED_TOKENS.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols).not.toContain('QTT'); // Kamet-only
  });

  it('targets Kamet (Route 1) + Sepolia/Base (Route 2) and never itself', () => {
    expect(MAKALU_DESTINATION_CHAINS.map((c) => c.chainId)).toEqual([900523, 11155111, 84532]);
    for (const c of MAKALU_DESTINATION_CHAINS) {
      expect(c.chainId).not.toBe(MAKALU_CHAIN_ID);
    }
  });

  it('constructs a ready MultXClient', () => {
    const client = new MultXClient(MAKALU_TESTNET);
    expect(client.isContractDeployed()).toBe(true);
    expect(client.bridgeAddress).toBe(MAKALU_BRIDGE_ADDRESS);
    expect(client.supportedTokens).toHaveLength(10);
  });
});
