import 'dotenv/config';
import { ethers } from 'ethers';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple indexer that monitors blockchain events
async function startIndexer() {
  console.log('Starting Lithosphere Indexer...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('RPC URL:', process.env.LITHO_RPC_URL);
  
  // Health check endpoint
  const express = await import('express');
  const app = express.default();
  
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'healthy', 
      service: 'lithosphere-indexer',
      timestamp: new Date().toISOString()
    });
  });
  
  const port = process.env.INDEXER_PORT || 3001;
  app.listen(port, () => {
    console.log(`Indexer health endpoint running on :${port}`);
  });

  // TODO: Implement blockchain polling logic here
  console.log('Indexer service ready');
}

startIndexer().catch(console.error);

