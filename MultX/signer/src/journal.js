import fs from 'fs';
import path from 'path';

export function createDecisionJournal(stateFile) {
  const directory = path.dirname(stateFile);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);

  const decisions = new Map();
  if (fs.existsSync(stateFile)) {
    const stat = fs.lstatSync(stateFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('signing journal must be a regular file, not a symlink');
    }
    fs.chmodSync(stateFile, 0o600);
    for (const [index, line] of fs.readFileSync(stateFile, 'utf8').split('\n').filter(Boolean).entries()) {
      let record;
      try { record = JSON.parse(line); }
      catch { throw new Error(`invalid JSON in signing journal line ${index + 1}`); }
      if (!/^[1-9][0-9]*:[1-9][0-9]*$/.test(record?.key || '') ||
          !/^0x[0-9a-fA-F]{64}$/.test(record?.hash || '')) {
        throw new Error(`invalid signing journal record at line ${index + 1}`);
      }
      const prior = decisions.get(record.key);
      if (prior && prior !== record.hash) throw new Error(`equivocation detected in state for ${record.key}`);
      decisions.set(record.key, record.hash);
    }
  }

  return {
    record(key, hash) {
      if (!/^[1-9][0-9]*:[1-9][0-9]*$/.test(key) || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        throw new Error('invalid signing journal decision');
      }
      const prior = decisions.get(key);
      if (prior && prior !== hash) throw new Error(`refusing equivocation for ${key}`);
      if (prior) return false;

      const fd = fs.openSync(stateFile, 'a', 0o600);
      try {
        fs.writeSync(fd, `${JSON.stringify({ key, hash, at: new Date().toISOString() })}\n`);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      decisions.set(key, hash);
      return true;
    },
  };
}
