// Independent JavaScript deterministic history-sequence conformance runner.
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const vectors=JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vectors','history_sequences.json'),'utf8'));
const MAX=18446744073709551615n;
function validate(c){const prior=BigInt(c.prior);if(prior===MAX)return'SEQUENCE_OVERFLOW';const expected=prior+1n;if(c.stream==='key')return BigInt(c.record)===prior&&BigInt(c.next)===expected?'ACCEPT':'SEQUENCE_MISMATCH';const values=['registry','provenance'].includes(c.stream)?[c.mutation,c.next,c.transition]:[];return values.length&&values.every(v=>BigInt(v)===expected)?'ACCEPT':'SEQUENCE_MISMATCH';}
for(const c of vectors.cases){const actual=validate(c);if(actual!==c.expected)throw new Error(`history sequence mismatch: ${c.name}: ${actual}`);}
process.stdout.write(`javascript history sequences verified ${vectors.cases.length} cases\n`);
