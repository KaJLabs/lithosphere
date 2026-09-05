import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Wallet } from 'ethers';
import { createSigningKey, readSecurePrivateKey } from '../src/signingKey.js';

const withKeyFile = async (fn) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'multx-key-'));
  const file = path.join(directory, 'validator-key');
  const wallet = Wallet.createRandom();
  fs.writeFileSync(file, `${wallet.privateKey}\n`, { mode: 0o600 });
  try { await fn({ file, wallet }); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
};

test('loads only an owner-restricted mounted private key', async () => {
  await withKeyFile(async ({ file, wallet }) => {
    assert.equal(readSecurePrivateKey(file), wallet.privateKey);
    const signer = await createSigningKey({
      env: { NODE_ENV: 'production', SIGNER_PRIVATE_KEY_FILE: file },
    });
    assert.equal(signer.kind, 'file');
    assert.equal(signer.address, wallet.address);
  });
});

test('rejects malformed, permissive, and symlinked key files', async () => {
  await withKeyFile(async ({ file }) => {
    if (process.platform !== 'win32') {
      fs.chmodSync(file, 0o644);
      assert.throws(() => readSecurePrivateKey(file), /group or other/);
      fs.chmodSync(file, 0o600);
    }
    fs.writeFileSync(file, 'not-a-private-key\n');
    assert.throws(() => readSecurePrivateKey(file), /32-byte hex key/);

    if (process.platform !== 'win32') {
      const link = `${file}.link`;
      fs.symlinkSync(file, link);
      assert.throws(() => readSecurePrivateKey(link), /not a symlink/);
    }
  });
});

test('rejects legacy AWS signer configuration', async () => {
  await withKeyFile(async ({ file }) => {
    for (const [name, value] of [
      ['SIGNER_KMS_KEY_ARN', 'arn:rejected'],
      ['SIGNER_DYNAMODB_TABLE', 'rejected'],
      ['AWS_REGION', 'us-east-1'],
    ]) {
      await assert.rejects(
        createSigningKey({ env: { SIGNER_PRIVATE_KEY_FILE: file, [name]: value } }),
        new RegExp(`${name} is not supported`),
      );
    }
  });
});
