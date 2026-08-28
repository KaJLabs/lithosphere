// Independent JavaScript verifier for R8 CryptoRegistry mutation/lifecycle/root vectors.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const vectors=JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','vectors','registry_lifecycle.json'),'utf8'));
const STATES={1:'EXPERIMENTAL',2:'ACTIVE',3:'DEPRECATED',4:'DISABLED'},NORMAL=new Set(['1:2','2:3','3:4']);
const header=(type,count)=>Buffer.concat([Buffer.from('LCE1'),Buffer.from([(type>>8)&255,type&255,0,1,(count>>8)&255,count&255])]);
const field=(tag,wire,payload)=>Buffer.concat([Buffer.from([(tag>>8)&255,tag&255,wire]),Buffer.from([(payload.length>>>24)&255,(payload.length>>>16)&255,(payload.length>>>8)&255,payload.length&255]),payload]);
const object=(type,items)=>Buffer.concat([header(type,items.length),...items]);
const u8=(t,v)=>field(t,1,Buffer.from([v]));
const u16=(t,v)=>field(t,2,Buffer.from([(v>>8)&255,v&255]));
const u32=(t,v)=>{const b=Buffer.alloc(4);b.writeUInt32BE(v);return field(t,3,b);};
const u64=(t,v)=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(v));return field(t,4,b);};
const bytes=(t,v)=>field(t,16,v),ascii=(t,v)=>field(t,17,Buffer.from(v,'ascii'));
const list=(t,items)=>{const parts=[Buffer.from([(items.length>>8)&255,items.length&255])];for(const item of items){const n=Buffer.alloc(4);n.writeUInt32BE(item.length);parts.push(n,item);}return field(t,33,Buffer.concat(parts));};
const digest=(name,data)=>crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from(`${name}\0`,'ascii'),data])).digest();
const clone=value=>JSON.parse(JSON.stringify(value));

function profileBytes(item){const f=item.id&255;return object(0x0040,[u16(1,item.id),ascii(2,item.name),bytes(3,Buffer.alloc(32,f)),bytes(4,Buffer.alloc(32)),bytes(5,Buffer.alloc(64,f^0x55)),bytes(6,Buffer.from('LITHO-PQ-AUTH-V1')),u32(7,1952),u32(8,3309),bytes(9,Buffer.alloc(64,f^0xaa)),bytes(10,Buffer.alloc(64,f^0xcc)),u64(11,item.definition_height)]);}
function lifecycleBytes(item){return object(0x0044,[u16(1,item.id),u8(2,item.current),u64(3,item.state_height),u8(4,item.scheduled),u64(5,item.scheduled_height)]);}
function stateBytes(state){return object(0x0042,[u64(1,state.sequence),list(2,state.profiles.map(profileBytes)),list(3,state.lifecycles.map(lifecycleBytes)),bytes(4,Buffer.from(state.prior_root,'hex'))]);}
const root=state=>digest('LITHO_CRYPTO_PROFILE_STATE_V1',stateBytes(state)).toString('hex');
const lifecycle=(state,id)=>state.lifecycles.find(item=>item.id===id);
const effective=(entry,height)=>entry.scheduled&&height>=entry.scheduled_height?entry.scheduled:entry.current;
function materialize(entry,height){if(entry.scheduled&&height>=entry.scheduled_height){entry.current=entry.scheduled;entry.state_height=entry.scheduled_height;entry.scheduled=0;entry.scheduled_height=0;}}
function commit(state,work){const old=root(state);for(const key of Object.keys(state))delete state[key];Object.assign(state,work);state.sequence+=1;state.prior_root=old;}

function apply(state,op,height){const kind=op.type,id=op.profile_id??1,entry=lifecycle(state,id);if(['observe','historical'].includes(kind))return [entry!==undefined,entry?'OK':'PROFILE_NOT_FOUND'];if(kind==='admit_registration'){if(!entry)return [false,'PROFILE_NOT_FOUND'];const value=effective(entry,height);return [value===1||value===2,value===1||value===2?'OK':value===3?'PROFILE_DEPRECATED':'PROFILE_DISABLED'];}const work=clone(state),target=lifecycle(work,id);if(kind==='define'){const p=op.proposed_profile;if(target)return [false,'PROFILE_EXISTS'];if(!p||p.id!==id)return [false,'PROFILE_ID_MISMATCH'];if(op.prior_state!==0||op.next_state!==1)return [false,'INVALID_DEFINE_LIFECYCLE'];if(op.activation_height!==height||p.definition_height!==height)return [false,'INVALID_DEFINE_HEIGHT'];work.profiles.push(p);work.lifecycles.push({id,current:1,state_height:height,scheduled:0,scheduled_height:0});work.profiles.sort((a,b)=>a.id-b.id);work.lifecycles.sort((a,b)=>a.id-b.id);}else{if(!target)return [false,'PROFILE_NOT_FOUND'];materialize(target,height);if(op.prior_state!==target.current)return [false,'PRIOR_STATE_MISMATCH'];if(kind==='schedule'){if(target.scheduled)return [false,'SCHEDULE_EXISTS'];if(!NORMAL.has(`${target.current}:${op.next_state}`))return [false,'INVALID_NORMAL_EDGE'];if(op.activation_height<height+86400)return [false,'NORMAL_DELAY'];target.scheduled=op.next_state;target.scheduled_height=op.activation_height;}else if(kind==='cancel'){const stored=lifecycle(state,id);if(!stored||stored.scheduled===0)return [false,'NO_SCHEDULE'];if(height>=stored.scheduled_height)return [false,'SCHEDULE_ALREADY_EFFECTIVE'];if((op.next_state??0)!==0||(op.activation_height??0)!==0)return [false,'INVALID_CANCEL_FIELDS'];target.scheduled=0;target.scheduled_height=0;}else if(kind==='emergency_disable'){if(target.current===4)return [false,'ALREADY_DISABLED'];if(op.next_state!==4)return [false,'INVALID_EMERGENCY_TARGET'];if(op.activation_height<height+100)return [false,'EMERGENCY_DELAY'];target.scheduled=4;target.scheduled_height=op.activation_height;}else return [false,'UNKNOWN_OPERATION'];}commit(state,work);return [true,'OK'];}
function execute(test){const state=clone(test.initial),trace=[];for(const step of test.steps){const before=root(state),[accepted,error]=apply(state,step.operation,step.height),entry=lifecycle(state,step.operation.profile_id??1);trace.push({accepted,error,effective_state:entry?STATES[effective(entry,step.height)]:'ABSENT',state_sequence:state.sequence,root_before:before,root_after:root(state)});}return {trace,final_state:{...state,root:root(state)}};}

if(vectors.schema!=='CRYPTO_REGISTRY_LIFECYCLE_V1')throw new Error('wrong schema');
for(const test of vectors.cases){const actual=execute(test);if(JSON.stringify(actual)!==JSON.stringify(test.expected))throw new Error(`registry lifecycle mismatch: ${test.name}\nexpected=${JSON.stringify(test.expected)}\nactual=${JSON.stringify(actual)}`);}
process.stdout.write(`independent registry mutation/lifecycle verified ${vectors.cases.length} cases with exact LCE roots\n`);
