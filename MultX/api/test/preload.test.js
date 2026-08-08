import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadSecrets } from '../src/preload.js';

const vars = [
  'NODE_ENV',
  'DB_PASSWORD',
  'DB_PASSWORD_FILE',
  'RELAYER_PRIVATE_KEY',
  'RELAYER_PRIVATE_KEY_FILE',
  'AUTH_SESSION_SECRET',
  'AUTH_SESSION_SECRET_FILE',
];

const snapshot = Object.fromEntries(vars.map((name) => [name, process.env[name]]));

const reset = () => {
  for (const name of vars) {
    if (snapshot[name] === undefined) delete process.env[name];
    else process.env[name] = snapshot[name];
  }
};

test.afterEach(reset);

test('loads a production database password from an absolute mounted file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multx-preload-'));
  const file = path.join(dir, 'db-password');
  fs.writeFileSync(file, 'test-only-password\n', { mode: 0o600 });
  process.env.NODE_ENV = 'production';
  delete process.env.DB_PASSWORD;
  process.env.DB_PASSWORD_FILE = file;

  await loadSecrets();

  assert.equal(process.env.DB_PASSWORD, 'test-only-password');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rejects plaintext production secrets', async () => {
  process.env.NODE_ENV = 'production';
  process.env.DB_PASSWORD = 'test-only-password';
  await assert.rejects(loadSecrets(), /must be supplied through DB_PASSWORD_FILE/);
});

test('requires the production database secret file', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.DB_PASSWORD;
  delete process.env.DB_PASSWORD_FILE;
  await assert.rejects(loadSecrets(), /DB_PASSWORD_FILE is required/);
});

