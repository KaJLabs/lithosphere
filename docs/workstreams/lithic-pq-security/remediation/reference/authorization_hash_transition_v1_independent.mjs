// Independent JS reconstruction of AUTHORIZATION_HASH_TRANSITION_V1.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const corpus=JSON.parse(readFileSync(join(root,'vectors','authorization_hash_transitions.json'),'utf8'));
const SUBJECT=Buffer.from('11'.repeat(20),'hex'), ZERO64=Buffer.alloc(64);
const REQUEST_HEIGHT=100n, DEADLINE=110n, ACTIVATION=120n;
const profiles=new Map([[0x0201,64],[0x8001,33]]);
const ops={
 REGISTER:[1,0x0004,'LITHO_KEY_REGISTRATION_V1',1],
 ROTATE:[2,0x0005,'LITHO_KEY_ROTATION_V1',2],
 DISABLE:[3,0x0007,'LITHO_CLASSICAL_DISABLE_V1',3],
 RECOVER:[4,0x0008,'LITHO_RECOVERY_ACTION_V1',4],
};

const b=n=>{const x=Buffer.alloc(n);return x;};
const integer=(value,size)=>{let v=BigInt(value);const out=b(size);for(let i=size-1;i>=0;i--){out[i]=Number(v&255n);v>>=8n;}return out;};
const fld=(tag,wire,payload)=>({tag,wire,payload:Buffer.from(payload)});
const u8=(t,v)=>fld(t,1,integer(v,1)), u16=(t,v)=>fld(t,2,integer(v,2)), u32=(t,v)=>fld(t,3,integer(v,4)), u64=(t,v)=>fld(t,4,integer(v,8));
const bytes=(t,v)=>fld(t,0x10,v), object=(t,v)=>fld(t,0x20,v);
const objects=(t,values)=>{const parts=[integer(values.length,2)];for(const value of values)parts.push(integer(value.length,4),value);return fld(t,0x21,Buffer.concat(parts));};
const encode=(type,fields)=>{const head=Buffer.concat([Buffer.from('LCE1'),integer(type,2),integer(1,2),integer(fields.length,2)]);const body=[];for(const f of fields)body.push(integer(f.tag,2),integer(f.wire,1),integer(f.payload.length,4),f.payload);return Buffer.concat([head,...body]);};
const sha=value=>createHash('sha3-512').update(value).digest();
const commitment=(domain,value)=>sha(Buffer.concat([Buffer.from(domain,'ascii'),Buffer.from([0]),value]));
const label=value=>sha(Buffer.concat([Buffer.from('LITHO_R8_VECTOR\0','ascii'),Buffer.from(value,'ascii')]));

function material(profile,fill){return encode(0x0015,[u16(1,profile),bytes(2,Buffer.alloc(profiles.get(profile),fill))]);}
function keyNode(profile,signer,slot,epoch,publicKey){
 const params=encode(0x0052,[u16(1,profile),bytes(2,Buffer.from(signer)),u16(3,slot),u64(4,epoch),u8(5,4),bytes(6,commitment('LITHO_PUBLIC_KEY_COMMITMENT_V1',publicKey))]);
 return encode(0x0051,[u8(1,1),object(2,params)]);
}
function policy(version,epoch,profile,signer,slot,keyEpoch,publicKey){return encode(0x0050,[
 bytes(1,Buffer.from('51'.repeat(32),'hex')),u64(2,version),u8(3,1),bytes(4,SUBJECT),u64(5,epoch),
 object(6,keyNode(profile,signer,slot,keyEpoch,publicKey)),u64(8,1),bytes(9,ZERO64),u32(10,1),
]);}
function keyState(slot,epoch,profile,publicKey,state,origin,activation,retirement,predecessor){return encode(0x0019,[
 u16(1,slot),u64(2,epoch),u16(3,profile),object(4,publicKey),u8(5,state),bytes(6,origin),u64(7,activation),u64(8,retirement),bytes(9,predecessor),
]);}
function subjectState(policyVersion,policyCommitment,authEpoch,keys,pending=null,lifecycleSequence=1){const f=[u8(1,1),bytes(2,SUBJECT),u64(3,policyVersion),bytes(4,policyCommitment),u64(5,authEpoch)];if(pending)f.push(object(6,pending));f.push(objects(7,keys),u64(8,lifecycleSequence));return encode(0x0018,f);}
function lifecycle(sequence,before,code,operation,after,height,authLabel){return encode(0x001a,[
 u64(1,sequence),bytes(2,commitment('LITHO_SUBJECT_AUTH_STATE_V1',before)),u8(3,code),bytes(4,operation),
 bytes(5,commitment('LITHO_SUBJECT_AUTH_STATE_V1',after)),u64(6,height),bytes(7,label(authLabel)),
]);}

const CLASSICAL=material(0x8001,0x21), PQ_ACTIVE=material(0x0201,0x22);
const INITIAL_POLICY=policy(1,1,0x0201,'pq-active',2,1,PQ_ACTIVE);
const currentPolicyCommitment=()=>commitment('LITHO_POLICY_STATE_V1',INITIAL_POLICY);
const initialKeys=()=>[
 keyState(1,1,0x8001,CLASSICAL,4,label('genesis-classical'),1,0,ZERO64),
 keyState(2,1,0x0201,PQ_ACTIVE,4,label('genesis-pq'),1,0,ZERO64),
];

function request(kind,currentRoot,nextPolicy,nextPolicyObj,proposed){
 if(kind==='REGISTER')return encode(0x0010,[u8(1,1),bytes(2,SUBJECT),u16(3,0x0201),u16(4,3),u64(5,1),object(6,proposed),u64(7,ACTIVATION),u64(8,DEADLINE),bytes(9,nextPolicy),bytes(10,currentRoot),object(11,nextPolicyObj)]);
 if(kind==='ROTATE')return encode(0x0011,[u8(1,1),bytes(2,SUBJECT),u16(3,0x0201),u16(4,2),u64(5,1),u64(6,2),object(7,proposed),u64(8,ACTIVATION),u64(9,DEADLINE),bytes(10,nextPolicy),bytes(11,currentRoot),object(12,nextPolicyObj)]);
 if(kind==='DISABLE')return encode(0x0013,[u8(1,1),bytes(2,SUBJECT),u16(3,1),u64(4,1),bytes(5,currentPolicyCommitment()),bytes(6,nextPolicy),u64(7,ACTIVATION),bytes(8,label('disable-reason')),u64(9,DEADLINE),bytes(10,currentRoot),object(11,nextPolicyObj)]);
 return encode(0x0014,[u8(1,1),bytes(2,SUBJECT),u64(3,1),u16(4,2),u64(5,1),u16(6,0x0201),u16(7,2),u64(8,2),object(9,proposed),u64(10,ACTIVATION),u64(11,DEADLINE),bytes(12,label('recovery-case')),bytes(13,nextPolicy),bytes(14,currentRoot),object(15,nextPolicyObj)]);
}

function build(kind){
 const [opKind,domainId,domainName,requestCode]=ops[kind];const baseKeys=initialKeys();
 const initial=subjectState(1,currentPolicyCommitment(),1,baseKeys);const initialRoot=commitment('LITHO_SUBJECT_AUTH_STATE_V1',initial);
 let targetSlot,targetEpoch,priorSlot,priorEpoch,proposed,nextSigner;
 if(kind==='REGISTER'){[targetSlot,targetEpoch,priorSlot,priorEpoch,proposed,nextSigner]=[3,1,0,0,material(0x0201,0x31),'registered-pq'];}
 else if(kind==='ROTATE'){[targetSlot,targetEpoch,priorSlot,priorEpoch,proposed,nextSigner]=[2,2,2,1,material(0x0201,0x32),'rotated-pq'];}
 else if(kind==='RECOVER'){[targetSlot,targetEpoch,priorSlot,priorEpoch,proposed,nextSigner]=[2,2,2,1,material(0x0201,0x33),'recovered-pq'];}
 else {[targetSlot,targetEpoch,priorSlot,priorEpoch,proposed,nextSigner]=[1,2,1,1,null,'pq-active'];}
 const nextMaterial=proposed??PQ_ACTIVE,nextSlot=kind==='DISABLE'?2:targetSlot,nextEpoch=kind==='DISABLE'?1:targetEpoch;
 const nextPolicyObj=policy(2,2,0x0201,nextSigner,nextSlot,nextEpoch,nextMaterial),nextPolicyRoot=commitment('LITHO_POLICY_STATE_V1',nextPolicyObj);
 const requestObj=request(kind,initialRoot,nextPolicyRoot,nextPolicyObj,proposed),requestCommitment=commitment(domainName,requestObj);
 const proposedCommitment=proposed?commitment('LITHO_PUBLIC_KEY_COMMITMENT_V1',proposed):ZERO64;
 const pending=encode(0x001b,[u8(1,opKind),u16(2,domainId),bytes(3,requestCommitment),u16(4,targetSlot),u64(5,targetEpoch),u64(6,ACTIVATION),u64(7,DEADLINE),u8(8,opKind),u64(9,2),bytes(10,nextPolicyRoot),u64(11,2),bytes(12,proposedCommitment),u64(13,priorEpoch),u8(14,kind==='DISABLE'?6:4),u16(15,priorSlot)]);
 const pendingKeys=[...baseKeys];if(proposed){const predecessor=priorEpoch?commitment('LITHO_KEY_STATE_ENTRY_V1',baseKeys[1]):ZERO64;pendingKeys.push(keyState(targetSlot,targetEpoch,0x0201,proposed,2,requestCommitment,0,0,predecessor));}
 const pendingState=subjectState(1,currentPolicyCommitment(),1,pendingKeys,pending,2),pendingRoot=commitment('LITHO_SUBJECT_AUTH_STATE_V1',pendingState);
 const requestRecord=lifecycle(1,initial,requestCode,requestCommitment,pendingState,REQUEST_HEIGHT,`${kind}-request-auth`);
 const cancelledKeys=pendingKeys.map((item,index)=>proposed&&index===pendingKeys.length-1?keyState(targetSlot,targetEpoch,0x0201,proposed,3,requestCommitment,0,105,priorEpoch?commitment('LITHO_KEY_STATE_ENTRY_V1',baseKeys[1]):ZERO64):item);
 const cancelledState=subjectState(1,currentPolicyCommitment(),1,cancelledKeys,null,3),cancelledRoot=commitment('LITHO_SUBJECT_AUTH_STATE_V1',cancelledState);
 const cancelObj=encode(0x0012,[u8(1,1),bytes(2,SUBJECT),bytes(3,commitment('LITHO_PENDING_AUTH_MUTATION_V1',pending)),bytes(5,pendingRoot),bytes(6,cancelledRoot)]),cancelCommitment=commitment('LITHO_CANCEL_PENDING_MUTATION_V1',cancelObj);
 const cancelRecord=lifecycle(2,pendingState,5,cancelCommitment,cancelledState,105,`${kind}-cancel-auth`);
 const activatedKeys=baseKeys.map((item,index)=>{
  if(kind==='ROTATE'&&index===1)return keyState(2,1,0x0201,PQ_ACTIVE,5,label('genesis-pq'),1,ACTIVATION,ZERO64);
  if(kind==='DISABLE'&&index===0)return keyState(1,1,0x8001,CLASSICAL,6,label('genesis-classical'),1,ACTIVATION,ZERO64);
  if(kind==='RECOVER'&&index===1)return keyState(2,1,0x0201,PQ_ACTIVE,7,label('genesis-pq'),1,ACTIVATION,ZERO64);
  return item;
 });
 if(proposed)activatedKeys.push(keyState(targetSlot,targetEpoch,0x0201,proposed,4,requestCommitment,ACTIVATION,0,priorEpoch?commitment('LITHO_KEY_STATE_ENTRY_V1',baseKeys[1]):ZERO64));
 const activatedState=subjectState(2,nextPolicyRoot,2,activatedKeys,null,3),activatedRoot=commitment('LITHO_SUBJECT_AUTH_STATE_V1',activatedState);
 const activationObj=encode(0x0017,[u8(1,1),bytes(2,SUBJECT),bytes(3,commitment('LITHO_PENDING_AUTH_MUTATION_V1',pending)),bytes(4,pendingRoot),bytes(6,activatedRoot)]),activationCommitment=commitment('LITHO_ACTIVATE_PENDING_MUTATION_V1',activationObj);
 const policyMutation=encode(0x0016,[u8(1,1),bytes(2,SUBJECT),u8(3,opKind),u64(4,1),bytes(5,currentPolicyCommitment()),u64(6,2),bytes(7,nextPolicyRoot),u64(8,1),u64(9,2),u16(10,targetSlot),u64(11,priorEpoch),u64(12,targetEpoch),u64(13,ACTIVATION),u64(14,DEADLINE),bytes(15,activationCommitment)]);
 const activationRecord=lifecycle(2,pendingState,6,activationCommitment,activatedState,ACTIVATION,`${kind}-activation-envelope`);
 return {initial_policy:INITIAL_POLICY,next_policy:nextPolicyObj,initial_state:initial,request_operation:requestObj,pending_mutation:pending,pending_state:pendingState,request_lifecycle:requestRecord,cancel_operation:cancelObj,cancelled_state:cancelledState,cancel_lifecycle:cancelRecord,activation_operation:activationObj,activated_state:activatedState,policy_mutation:policyMutation,activation_lifecycle:activationRecord};
}

if(corpus.schema!=='AUTHORIZATION_HASH_TRANSITION_V1')throw new Error('wrong vector schema');
for(const entry of corpus.cases){const actual=build(entry.name.toUpperCase());for(const [name,value] of Object.entries(actual)){const expected=entry.expected[name];if(value.toString('hex')!==expected.canonical_hex)throw new Error(`${entry.name}/${name}: canonical mismatch`);if(sha(value).toString('hex')!==expected.sha3_512)throw new Error(`${entry.name}/${name}: hash mismatch`);if(expected.domain&&commitment(expected.domain,value).toString('hex')!==expected.commitment)throw new Error(`${entry.name}/${name}: commitment mismatch`);}}
console.log(`independent authorization hash runner verified ${corpus.cases.length} complete request/cancel/activate branches`);
