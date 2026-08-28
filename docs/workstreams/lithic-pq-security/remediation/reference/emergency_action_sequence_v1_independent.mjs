// Independent JavaScript R8 emergency registry sole-counter runner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vectors','emergency_action_sequences.json');
const vectors=JSON.parse(fs.readFileSync(file,'utf8'));
const MAX=(1n<<64n)-1n;
function execute(initial,test){
 const state=structuredClone(initial),accepted=[],errors=[];
 for(const op of test.operations){
  if(op.type==='rotate'){state.authority=op.new_authority;accepted.push(true);errors.push('OK');continue;}
  if(op.type!=='emergency')throw new Error(`unknown operation ${op.type}`);
  let ok=false,error;
  if(state.general_sequence_present)error='COMPETING_SEQUENCE_STATE';
  else if(state.next_sequence===null)error='MISSING_EMERGENCY_SEQUENCE_STATE';
  else if(op.authority!==state.authority)error='EMERGENCY_AUTHORITY_MISMATCH';
  else if(op.sequence!==state.next_sequence)error='EMERGENCY_SEQUENCE_MISMATCH';
  else if(!op.action_valid)error='ACTION_REJECTED';
  else if(BigInt(state.next_sequence)===MAX)error='SEQUENCE_OVERFLOW';
  else{state.next_sequence+=1;ok=true;error='OK';}
  accepted.push(ok);errors.push(error);
 }
 return {accepted,errors,state};
}
for(const test of vectors.cases){
 const initial={...vectors.initial,...(test.initial_override??{})};
 const actual=execute(initial,test);
 if(JSON.stringify(actual)!==JSON.stringify(test.expected))throw new Error(`emergency sequence mismatch: ${test.name}`);
}
process.stdout.write(`javascript emergency sole-counter verified ${vectors.cases.length} cases\n`);
