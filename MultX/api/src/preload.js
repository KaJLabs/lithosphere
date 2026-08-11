import fs from 'fs';
import path from 'path';

// VPS/Docker secret bootstrap. Sensitive values are mounted as files and read
// before config.js evaluates; they are never fetched through cloud credentials.
const MAPPINGS = [
  ['DB_PASSWORD', 'DB_PASSWORD_FILE'],
  ['RELAYER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY_FILE'],
  ['AUTH_SESSION_SECRET', 'AUTH_SESSION_SECRET_FILE'],
];

const loadFileValue = (fileVar, plainVar) => {
  const file = process.env[fileVar];
  if (!file) return;
  if (!path.isAbsolute(file)) throw new Error(`${fileVar} must be an absolute path`);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${fileVar} does not reference a regular file`);
  const value = fs.readFileSync(file, 'utf8').trim();
  if (!value) throw new Error(`${fileVar} is empty`);
  process.env[plainVar] = value;
  console.log(`[preload] loaded ${plainVar} from mounted file`);
};

export async function loadSecrets() {
  for (const [plainVar, fileVar] of MAPPINGS) {
    if (process.env[plainVar]) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`${plainVar} must be supplied through ${fileVar} in production`);
      }
      continue;
    }
    loadFileValue(fileVar, plainVar);
  }
  if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD_FILE is required in production');
  }
}
