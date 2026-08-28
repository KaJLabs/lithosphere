// Independent JavaScript R8 authorization-subject binding runner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const vectors=JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vectors','subject_action_bindings.json'),'utf8'));
const rules=new Map([
 ['1/1','1/principal'],['1/2','1/principal'],['1/3','1/principal'],
 ['2/1','*/operation'],['2/2','*/operation'],['2/3','*/operation'],['2/4','*/operation'],['2/5','*/operation'],
 ['4/1','4/registered'],['4/2','4/registered'],['4/3','4/registered'],['4/4','4/registered'],
 ['5/1','5/registered'],['6/1','6/registered'],['6/2','6/registered'],['6/3','6/registered'],
 ['6/4','6/registered'],['6/5','4/registered'],['6/6','6/registered'],
]);
function validate(c){
 const rule=rules.get(`${c.namespace}/${c.action}`);
 if(!rule||rule.split('/')[1]!==c.mode)return'SUBJECT_ACTION_MISMATCH';
 if(rule.split('/')[0]!=='*'&&Number(rule.split('/')[0])!==c.signing_subject_kind)return'SUBJECT_ACTION_MISMATCH';
 if(![1,2,3,4,5,6].includes(c.signing_subject_kind))return'SUBJECT_ACTION_MISMATCH';
 if(c.bound_subject_kind!==c.signing_subject_kind)return'SUBJECT_ACTION_MISMATCH';
 if(c.mode==='principal'&&![1,2].includes(c.principal_namespace))return'SUBJECT_ACTION_MISMATCH';
 if(!/^[0-9a-f]+$/.test(c.signing_subject_id)||!/^([0-9a-f]+)$/.test(c.bound_subject_id))return'SUBJECT_ACTION_MISMATCH';
 const expected=[1,3].includes(c.signing_subject_kind)?40:64;
 if(c.signing_subject_id.length!==expected||c.bound_subject_id.length!==expected||c.signing_subject_id!==c.bound_subject_id)return'SUBJECT_ACTION_MISMATCH';
 return'ACCEPT';
}
for(const c of vectors.cases){const actual=validate(c);if(actual!==c.expected)throw new Error(`subject binding mismatch: ${c.name}: ${actual}`);}
process.stdout.write(`javascript subject/action binding verified ${vectors.cases.length} cases\n`);
