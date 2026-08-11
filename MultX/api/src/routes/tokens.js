import express from 'express';
import { ethers } from 'ethers';
import { config } from '../config.js';

const router = express.Router();

const ERC20_ABI = [
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)'
];

// GET /tokens/:tokenAddress
router.get('/:tokenAddress', async (req, res, next) => {
  try {
    const { tokenAddress } = req.params;

    const provider = new ethers.JsonRpcProvider(config.lithoRpcHttp);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18),
      contract.totalSupply().catch(() => '0')
    ]);

    res.json({
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply: totalSupply.toString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;
