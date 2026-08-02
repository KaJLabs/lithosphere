import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const auditTargets = [
  {
    label: 'Public Assets',
    dir: path.join(rootDir, 'public'),
    extensions: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico'])
  },
  {
    label: 'Source Icons',
    dir: path.join(rootDir, 'src', 'assets', 'icons'),
    extensions: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico'])
  }
];

const formatBytes = (value) => {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} kB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const listFiles = async ({ dir, extensions }) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    if (!extensions.has(ext)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const stats = await fs.stat(fullPath);
    files.push({
      name: entry.name,
      size: stats.size
    });
  }

  return files.sort((left, right) => right.size - left.size);
};

for (const target of auditTargets) {
  const files = await listFiles(target);

  console.log(`\n${target.label}`);
  console.log('-'.repeat(target.label.length));

  if (!files.length) {
    console.log('No matching assets found.');
    continue;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`Total assets: ${files.length}`);
  console.log(`Total size: ${formatBytes(totalSize)}`);
  console.log('Largest files:');

  files.slice(0, 10).forEach((file) => {
    console.log(`- ${file.name}: ${formatBytes(file.size)}`);
  });
}
