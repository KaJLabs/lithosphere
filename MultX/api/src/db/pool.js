import pkg from 'pg';
import { config } from '../config.js';

const { Pool } = pkg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
