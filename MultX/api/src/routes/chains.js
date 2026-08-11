import express from 'express';
import { config } from '../config.js';

const router = express.Router();

// GET /chains
router.get('/', (req, res) => {
  res.json({
    chains: config.supportedChains
  });
});

export default router;
