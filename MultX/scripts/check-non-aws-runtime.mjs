import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => failures.push(message);

for (const packageName of ['api', 'signer']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, packageName, 'package.json'), 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const dependency of Object.keys(manifest[section] || {})) {
      if (dependency === 'aws-sdk' || dependency.startsWith('@aws-sdk/')) {
        fail(`${packageName}/package.json contains forbidden dependency ${dependency}`);
      }
    }
  }
}

for (const relative of [
  'api/Dockerfile.fargate-signer',
  'api/src/fargateSignerWorker.js',
  'api/src/services/kmsSigner.js',
  'signer/Dockerfile.fargate',
  'signer/src/dynamoJournal.js',
  'signer/src/kmsSigner.js',
]) {
  if (fs.existsSync(path.join(root, relative))) fail(`forbidden runtime path exists: ${relative}`);
}

const sourceFiles = [];
const collect = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.[cm]?js$/.test(entry.name)) sourceFiles.push(full);
  }
};
collect(path.join(root, 'api', 'src'));
collect(path.join(root, 'signer', 'src'));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/from\s+['"](?:@aws-sdk\/|aws-sdk['"])/.test(source) ||
      /require\(['"](?:@aws-sdk\/|aws-sdk['"])/.test(source)) {
    fail(`${path.relative(root, file)} imports a forbidden AWS SDK`);
  }
}

const compose = fs.readFileSync(path.join(root, 'infra', 'docker-compose.mainnet.template.yml'), 'utf8');
if (/FARGATE|KMS|DYNAMODB|AWS_|SIGNER_TOKEN_FILE/i.test(compose)) {
  fail('mainnet Compose template contains a forbidden AWS or bearer-signer setting');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Verified non-AWS MultX runtime boundary');
