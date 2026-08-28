"""Generate and self-check broad LCE1 R8 schema/semantic vectors."""
from __future__ import annotations
import hashlib,json
from pathlib import Path
from lce_v1 import (ASCII,BOOL,BYTES,OBJECT,OBJECT_LIST,U8,U16,U32,U64,U256,EXACT_BYTES,SCHEMAS,Field,LCEError,decode_object,encode_object,f_ascii,f_bool,f_bytes,f_object,f_object_list,f_u8,f_u16,f_u32,f_u64,f_u256)
ROOT=Path(__file__).resolve().parents[1];VECTORS=ROOT/"vectors"
def domain(name:str,obj:bytes)->bytes:return hashlib.sha3_512(name.encode("ascii")+b"\0"+obj).digest()
def chain_ref(chain_id="lithosphere_700777-2",evm_id=700777,genesis_byte=0x33,namespace=3):return encode_object(0x0031,[f_u8(1,namespace),f_ascii(2,chain_id),f_bytes(3,bytes([genesis_byte])*32),f_u64(4,evm_id)])
def principal(namespace=2,identity=None):return encode_object(0x0032,[f_u8(1,namespace),f_bytes(2,identity or bytes.fromhex("11"*(32 if namespace in (4,5) else 20)))])
def asset(chain=None,contract=None,decimals=18):return encode_object(0x0033,[f_object(1,chain or chain_ref()),f_u8(2,2),f_bytes(3,contract or bytes.fromhex("44"*20)),f_bytes(4,b""),f_u8(5,decimals)])
def public_key(profile=0x8001,fill=2):
 sizes={0x0101:1952,0x0102:2592,0x0201:64,0x8001:33};return encode_object(0x0015,[f_u16(1,profile),f_bytes(2,bytes([fill])+bytes(sizes[profile]-1))])
def key_params(profile=0x8001,signer=b"signer-a",slot=1,epoch=1,key_fill=None):
 material=public_key(profile,slot+1 if key_fill is None else key_fill);return encode_object(0x0052,[f_u16(1,profile),f_bytes(2,signer),f_u16(3,slot),f_u64(4,epoch),f_u8(5,4),f_bytes(6,domain("LITHO_PUBLIC_KEY_COMMITMENT_V1",material))])
def policy_node(kind,children=None,threshold=1,profile=0x8001,signer=b"signer-a",slot=1,key_fill=None):
 children=children or []
 if kind==1:params=key_params(profile,signer,slot,key_fill=key_fill)
 elif kind==2:params=encode_object(0x0053,[])
 elif kind==3:params=encode_object(0x0054,[f_u8(1,threshold)])
 elif kind==4:params=encode_object(0x0055,[f_u64(1,1)])
 elif kind==5:params=encode_object(0x0056,[f_bytes(1,bytes(32)),f_u8(2,1),f_object(3,asset()),f_u256(4,1),f_u64(5,10),f_u64(6,0),f_u8(7,1)])
 else:raise AssertionError(kind)
 fields=[f_u8(1,kind),f_object(2,params)]
 if kind!=1:fields.append(f_object_list(3,children))
 return encode_object(0x0051,fields)
def sorted_nodes(nodes):return sorted(nodes,key=lambda item:domain("LITHO_POLICY_NODE_V1",item))
def policy(recovery=False):
 fields=[f_bytes(1,bytes.fromhex("51"*32)),f_u64(2,1),f_u8(3,1),f_bytes(4,bytes.fromhex("11"*20)),f_u64(5,1),f_object(6,policy_node(1))]
 if recovery:fields.append(f_object(7,policy_node(1,profile=0x0201,signer=b"recovery",slot=9)))
 fields += [f_u64(8,1),f_bytes(9,bytes(64)),f_u32(10,1211 if recovery else 1042)];return encode_object(0x0050,fields)
def signing_payload():
 transfer=encode_object(0x0004,[f_object(1,principal()),f_object(2,principal(identity=bytes.fromhex("22"*20))),f_object(3,asset()),f_u256(4,1),f_bytes(5,bytes(64))])
 return encode_object(0x0001,[f_u16(1,1),f_ascii(2,"lithosphere_700777-2"),f_u64(3,700777),f_bytes(4,bytes.fromhex("55"*32)),f_u16(5,1),f_u16(6,1),f_u8(7,1),f_bytes(8,bytes.fromhex("11"*20)),f_u64(9,1),f_bytes(10,domain("LITHO_POLICY_STATE_V1",policy())),f_u64(11,1),f_u64(12,1),f_u64(13,0),f_ascii(14,"ulitho"),f_u256(15,1),f_u16(16,2),f_bytes(17,bytes(64))])
def signature():
 material=public_key();return encode_object(0x0003,[f_u8(1,1),f_u16(2,1),f_u64(3,1),f_u16(4,0x8001),f_bytes(5,b"signer-a"),f_bytes(6,domain("LITHO_PUBLIC_KEY_COMMITMENT_V1",material)),f_bytes(7,bytes(65))])
def authorization():return encode_object(0x0002,[f_object(1,signing_payload()),f_object_list(2,[signature()]),f_object(3,policy())])
def policy_for(kind,subject,footprint):
 root=policy_node(1,signer=subject);return encode_object(0x0050,[f_bytes(1,bytes.fromhex("61"*32)),f_u64(2,1),f_u8(3,kind),f_bytes(4,subject),f_u64(5,1),f_object(6,root),f_u64(8,1),f_bytes(9,bytes(64)),f_u32(10,footprint)])
def authorization_for(kind,subject,namespace,action,domain_id,commitment,policy_obj):
 payload=encode_object(0x0001,[f_u16(1,1),f_ascii(2,"lithosphere_700777-2"),f_u64(3,700777),f_bytes(4,bytes.fromhex("55"*32)),f_u16(5,namespace),f_u16(6,action),f_u8(7,kind),f_bytes(8,subject),f_u64(9,1),f_bytes(10,domain("LITHO_POLICY_STATE_V1",policy_obj)),f_u64(11,1),f_u64(12,1),f_u64(13,0),f_ascii(14,"ulitho"),f_u256(15,1),f_u16(16,domain_id),f_bytes(17,commitment)])
 material=public_key();sig=encode_object(0x0003,[f_u8(1,1),f_u16(2,1),f_u64(3,1),f_u16(4,0x8001),f_bytes(5,subject),f_bytes(6,domain("LITHO_PUBLIC_KEY_COMMITMENT_V1",material)),f_bytes(7,bytes(65))]);return encode_object(0x0002,[f_object(1,payload),f_object_list(2,[sig]),f_object(3,policy_obj)])
def provenance_envelope():
 record=sample(0x0100);commit=domain("LITHO_BUILD_PROVENANCE_V1",record);issuer_id=bytes.fromhex("ab"*32);statement=encode_object(0x010E,[f_u16(1,0x0100),f_u16(2,0x0030),f_bytes(3,commit),f_u64(4,1),f_bytes(5,bytes(64))]);statement_commit=domain("LITHO_PROVENANCE_STATEMENT_V1",statement);p=policy_for(6,issuer_id,1);auth=authorization_for(6,issuer_id,6,1,0x003b,statement_commit,p);p=policy_for(6,issuer_id,len(auth));auth=authorization_for(6,issuer_id,6,1,0x003b,statement_commit,p)
 return encode_object(0x010F,[f_u16(1,0x0100),f_object(2,record),f_u16(3,0x0030),f_bytes(4,commit),f_bytes(5,issuer_id),f_u8(6,1),f_u64(7,1),f_bytes(8,bytes(64)),f_object(9,auth),f_object(10,statement)])
def bridge_transfer():
 source=chain_ref(genesis_byte=0x22);dest=chain_ref("ethereum-sepolia",11155111,0x33,2)
 return encode_object(0x0030,[f_u16(1,1),f_object(2,source),f_object(3,dest),f_object(4,principal(3,bytes.fromhex("44"*20))),f_object(5,principal(3,bytes.fromhex("55"*20))),f_object(6,asset(source,bytes.fromhex("66"*20))),f_object(7,asset(dest,bytes.fromhex("77"*20))),f_u256(8,1),f_object(9,principal()),f_object(10,principal(identity=bytes.fromhex("99"*20))),f_bytes(11,bytes.fromhex("bb"*32)),f_u32(12,3),f_u64(13,42)])
def key_state():return encode_object(0x0019,[f_u16(1,1),f_u64(2,1),f_u16(3,0x8001),f_object(4,public_key()),f_u8(5,4),f_bytes(6,bytes(64)),f_u64(7,1),f_u64(8,0),f_bytes(9,bytes(64))])
def key_state_for(slot,profile=0x0201):return encode_object(0x0019,[f_u16(1,slot),f_u64(2,1),f_u16(3,profile),f_object(4,public_key(profile,slot+1)),f_u8(5,4),f_bytes(6,bytes(64)),f_u64(7,1),f_u64(8,0),f_bytes(9,bytes(64))])
def emergency_policy():
 authority=bytes.fromhex("e1"*32);children=sorted_nodes([policy_node(1,profile=0x0201,signer=f"emergency-{slot}".encode(),slot=slot) for slot in (1,2,3)]);root=policy_node(3,children,threshold=2)
 return encode_object(0x0050,[f_bytes(1,bytes.fromhex("e2"*32)),f_u64(2,1),f_u8(3,4),f_bytes(4,authority),f_u64(5,1),f_object(6,root),f_u64(8,1),f_bytes(9,bytes(64)),f_u32(10,1)])
def emergency_authority_state():
 authority=bytes.fromhex("e1"*32);p=emergency_policy();state=encode_object(0x0018,[f_u8(1,4),f_bytes(2,authority),f_u64(3,1),f_bytes(4,domain("LITHO_POLICY_STATE_V1",p)),f_u64(5,1),f_object_list(7,[key_state_for(slot) for slot in (1,2,3)]),f_u64(8,1)])
 return encode_object(0x0046,[f_bytes(1,authority),f_object(2,p),f_object(3,state),f_u64(4,1),f_bytes(5,bytes(64)),f_u64(6,1)])
def pending_mutation(op=2):
 domains={1:0x0004,2:0x0005,3:0x0007,4:0x0008};results={1:4,2:4,3:6,4:4};target_slot=2 if op==4 else 1
 return encode_object(0x001B,[f_u8(1,op),f_u16(2,domains[op]),f_bytes(3,bytes.fromhex("73"*64)),f_u16(4,target_slot),f_u64(5,1 if op==4 else 2),f_u64(6,101),f_u64(7,100),f_u8(8,op),f_u64(9,2),f_bytes(10,bytes.fromhex("72"*64)),f_u64(11,2),f_bytes(12,bytes(64) if op==3 else bytes.fromhex("74"*64)),f_u64(13,0 if op==1 else 1),f_u8(14,results[op]),f_u16(15,0 if op==1 else 1)])
def subject_state(pending=False):
 fields=[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u64(3,1),f_bytes(4,bytes(64)),f_u64(5,1)]
 if pending:fields.append(f_object(6,pending_mutation()))
 fields.extend([f_object_list(7,[key_state()]),f_u64(8,1)]);return encode_object(0x0018,fields)
def registration():
 p=policy();return encode_object(0x0010,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u16(3,0x8001),f_u16(4,1),f_u64(5,1),f_object(6,public_key()),f_u64(7,101),f_u64(8,100),f_bytes(9,domain("LITHO_POLICY_STATE_V1",p)),f_bytes(10,bytes(64)),f_object(11,p)])
def rotation():
 p=policy();return encode_object(0x0011,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u16(3,0x8001),f_u16(4,1),f_u64(5,1),f_u64(6,2),f_object(7,public_key()),f_u64(8,101),f_u64(9,100),f_bytes(10,domain("LITHO_POLICY_STATE_V1",p)),f_bytes(11,bytes(64)),f_object(12,p)])
def policy_mutation():return encode_object(0x0016,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u8(3,2),f_u64(4,1),f_bytes(5,bytes(64)),f_u64(6,2),f_bytes(7,bytes(64)),f_u64(8,1),f_u64(9,2),f_u16(10,1),f_u64(11,1),f_u64(12,2),f_u64(13,101),f_u64(14,100),f_bytes(15,bytes(64))])
def disable():
 p=policy();return encode_object(0x0013,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u16(3,1),f_u64(4,1),f_bytes(5,bytes(64)),f_bytes(6,domain("LITHO_POLICY_STATE_V1",p)),f_u64(7,101),f_bytes(8,bytes(64)),f_u64(9,100),f_bytes(10,bytes(64)),f_object(11,p)])
def recovery():
 p=policy();return encode_object(0x0014,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u64(3,1),f_u16(4,1),f_u64(5,1),f_u16(6,0x0201),f_u16(7,2),f_u64(8,2),f_object(9,public_key(0x0201)),f_u64(10,101),f_u64(11,100),f_bytes(12,bytes(64)),f_bytes(13,domain("LITHO_POLICY_STATE_V1",p)),f_bytes(14,bytes(64)),f_object(15,p)])
def cancellation():return encode_object(0x0012,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_bytes(3,domain("LITHO_PENDING_AUTH_MUTATION_V1",pending_mutation())),f_bytes(5,bytes(64)),f_bytes(6,bytes(64))])
def activation():return encode_object(0x0017,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_bytes(3,domain("LITHO_PENDING_AUTH_MUTATION_V1",pending_mutation())),f_bytes(4,bytes(64)),f_bytes(6,bytes(64))])
def fee_payment(action=None,payer_identity=None):
 action=action or activation();commit=domain("LITHO_ACTIVATE_PENDING_MUTATION_V1",action)
 return encode_object(0x001D,[f_object(1,principal(identity=payer_identity)),f_u16(2,0x000d),f_bytes(3,commit),f_ascii(4,"ulitho"),f_u256(5,1)])
def authorization_sequence_key():return encode_object(0x001E,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_u16(3,1),f_u16(4,1)])
def authorization_sequence_state():return encode_object(0x001F,[f_object(1,authorization_sequence_key()),f_u64(2,1),f_u64(3,1),f_bytes(4,bytes(64))])
def permissionless_envelope():
 action=activation();commit=domain("LITHO_ACTIVATE_PENDING_MUTATION_V1",action);fee=fee_payment(action);fee_commit=domain("LITHO_FEE_PAYMENT_ACTION_V1",fee);subject=bytes.fromhex("11"*20);p=policy_for(1,subject,1);auth=authorization_for(1,subject,1,3,0x0017,fee_commit,p)
 return encode_object(0x001C,[f_object(1,action),f_u16(2,0x000d),f_bytes(3,commit),f_object(4,fee),f_object(5,auth)])
def governance():return encode_object(0x0020,[f_u64(1,1),f_u16(2,1),f_u16(3,1),f_bytes(4,bytes(32)),f_bytes(5,bytes(64)),f_bytes(6,bytes(64)),f_bytes(7,bytes(64)),f_u64(8,1),f_u64(9,2),f_bool(10,False)])
def issuer(role=1,identity=bytes(32)):return encode_object(0x0110,[f_bytes(1,identity),f_u8(2,role),f_bytes(3,bytes(64)),f_u64(4,1),f_u64(5,1),f_u64(6,1),f_u64(7,0),f_bytes(8,bytes(64))])
def bridge_attestation():
 transfer=bridge_transfer();transfer_id=domain("LITHO_BRIDGE_TRANSFER_V1",transfer);return encode_object(0x0035,[f_object(1,transfer),f_bytes(2,transfer_id),f_bytes(3,bytes(64)),f_u16(4,1),f_bytes(5,bytes(32)),f_bytes(6,bytes(64))])
def finality_profile():return encode_object(0x0036,[f_u16(1,1),f_object(2,chain_ref()),f_u8(3,1),f_u64(4,0),f_u8(5,1),f_bytes(6,bytes(64)),f_u64(7,1),f_u64(8,0)])
def registry_profile(profile_id=1,name="PROFILE_1"):
 return encode_object(0x0040,[f_u16(1,profile_id),f_ascii(2,name),f_bytes(3,bytes.fromhex("11"*32)),f_bytes(4,bytes(32)),f_bytes(5,bytes.fromhex("22"*64)),f_bytes(6,b"LITHO-PQ-AUTH-V1"),f_u32(7,1952),f_u32(8,3309),f_bytes(9,bytes.fromhex("33"*64)),f_bytes(10,bytes.fromhex("44"*64)),f_u64(11,1)])
def registry_mutation():
 profile=registry_profile();commitment=domain("LITHO_CRYPTO_PROFILE_DEFINITION_V1",profile)
 return encode_object(0x0041,[f_u64(1,1),f_bytes(2,bytes(64)),f_u8(3,1),f_u16(4,1),f_u8(5,0),f_u8(6,1),f_u64(7,1),f_u64(8,1),f_bytes(9,commitment),f_u64(10,1),f_object(11,profile)])
def registry_lifecycle(profile_id=1,state=1,next_state=0,next_height=0):return encode_object(0x0044,[f_u16(1,profile_id),f_u8(2,state),f_u64(3,1),f_u8(4,next_state),f_u64(5,next_height)])
def registry_state(profiles=None,lifecycles=None):
 profiles=profiles or [registry_profile()];lifecycles=lifecycles or [registry_lifecycle()]
 return encode_object(0x0042,[f_u64(1,1),f_object_list(2,profiles),f_object_list(3,lifecycles),f_bytes(4,bytes(64))])
def inclusion_record():return encode_object(0x0113,[f_bytes(1,bytes(32)),f_u64(2,1),f_u64(3,0),f_bytes(4,bytes(64)),f_object_list(5,[]),f_bytes(6,bytes(64))])
def raw_object(t,fields):
 out=bytearray(b"LCE1"+t.to_bytes(2,"big")+b"\0\1"+len(fields).to_bytes(2,"big"))
 for f in fields:out+=f.tag.to_bytes(2,"big")+bytes([f.wire])+len(f.payload).to_bytes(4,"big")+f.payload
 return bytes(out)
def append_field(data,field):
 count=int.from_bytes(data[8:10],"big")
 encoded=field.tag.to_bytes(2,"big")+bytes([field.wire])+len(field.payload).to_bytes(4,"big")+field.payload
 return data[:8]+(count+1).to_bytes(2,"big")+data[10:]+encoded
def sample(t):
 special={0x0001:signing_payload,0x0002:authorization,0x0003:signature,0x0010:registration,0x0011:rotation,0x0012:cancellation,0x0013:disable,0x0014:recovery,0x0015:public_key,0x0016:policy_mutation,0x0017:activation,0x0018:subject_state,0x0019:key_state,0x001B:pending_mutation,0x001C:permissionless_envelope,0x001D:fee_payment,0x001E:authorization_sequence_key,0x001F:authorization_sequence_state,0x0020:governance,0x0030:bridge_transfer,0x0031:chain_ref,0x0032:principal,0x0033:asset,0x0050:policy,0x0051:lambda:policy_node(1),0x010E:lambda:encode_object(0x010E,[f_u16(1,0x0100),f_u16(2,0x0030),f_bytes(3,bytes(64)),f_u64(4,1),f_bytes(5,bytes(64))]),0x0115:lambda:encode_object(0x0115,[f_u64(1,1),f_bytes(2,bytes(64)),f_u8(3,1),f_u8(4,1),f_bytes(5,bytes(32)),f_bytes(6,bytes(64)),f_object(7,sample(0x0110)),f_u64(8,1),f_u64(9,1),f_bytes(10,bytes.fromhex("75"*64)),f_bytes(11,bytes(64))]),0x0117:lambda:encode_object(0x0117,[f_bytes(1,bytes(32)),f_u64(2,1),f_u64(3,1),f_bytes(4,bytes(64)),f_bytes(5,bytes(64)),f_object_list(6,[])])}
 special.update({0x0035:bridge_attestation,0x0036:finality_profile,0x0040:registry_profile,0x0041:registry_mutation,0x0042:registry_state,0x0044:registry_lifecycle,0x0046:emergency_authority_state,0x0052:key_params,0x010F:provenance_envelope,0x0110:issuer,0x0113:inclusion_record})
 if t in special:return special[t]()
 output=[]
 for tag,rule in SCHEMAS[t].items():
  if not rule.required:continue
  if rule.wire==U8:f=f_u8(tag,1)
  elif rule.wire==U16:f=f_u16(tag,1)
  elif rule.wire==U32:f=f_u32(tag,1)
  elif rule.wire==U64:f=f_u64(tag,1)
  elif rule.wire==U256:f=f_u256(tag,1)
  elif rule.wire==BOOL:f=f_bool(tag,False)
  elif rule.wire==ASCII:f=f_ascii(tag,"a"*(40 if (t,tag) in ((0x0100,3),(0x0102,7)) else 1))
  elif rule.wire==BYTES:f=f_bytes(tag,bytes(EXACT_BYTES.get((t,tag),1)))
  elif rule.wire==OBJECT:
   if rule.nested is None:raise AssertionError((t,tag,"untyped object"))
   f=f_object(tag,sample(rule.nested))
  elif rule.wire==OBJECT_LIST:
   if rule.list_nested is None:raise AssertionError((t,tag,"untyped list"))
   f=f_object_list(tag,[sample(rule.list_nested)])
  else:raise AssertionError(rule.wire)
  output.append(f)
 return encode_object(t,output)
def policy_variants():
 classical=policy_node(1,profile=0x8001,signer=b"classical",slot=1);pq=policy_node(1,profile=0x0101,signer=b"pq",slot=2);pq2=policy_node(1,profile=0x0102,signer=b"pq2",slot=3);pair=sorted_nodes([classical,pq])
 return {"policy_node_key":classical,"policy_node_and":policy_node(2,pair),"policy_node_threshold":policy_node(3,sorted_nodes([pq,pq2]),threshold=1),"policy_node_timelock":policy_node(4,[pq]),"policy_node_rate_limit":policy_node(5,[pq]),"policy_hybrid_auth":policy_node(2,pair),"policy_post_quantum_auth":pq,"policy_recovery_root":policy(True),"subject_state_pending":subject_state(True)}
def reject(name,data,output):
 try:decode_object(data)
 except LCEError:output.append({"name":name,"canonical_hex":data.hex(),"expected":"reject"})
 else:raise AssertionError(f"negative vector accepted: {name}")
def mutate_field(data,tag,wire=None,payload=None):
 count=int.from_bytes(data[8:10],"big");cursor=10;out=bytearray(data)
 for _ in range(count):
  current=int.from_bytes(out[cursor:cursor+2],"big");size=int.from_bytes(out[cursor+3:cursor+7],"big")
  if current==tag:
   if wire is not None:out[cursor+2]=wire
   if payload is not None:
    out[cursor+3:cursor+7]=len(payload).to_bytes(4,"big");out[cursor+7:cursor+7+size]=payload
    if len(payload)<size:del out[cursor+7+len(payload):cursor+7+size]
    elif len(payload)>size:out[cursor+7+size:cursor+7+size]=payload[size:]
   return bytes(out)
  cursor+=7+size
 raise AssertionError(tag)
def remove_field(data,tag):
 count=int.from_bytes(data[8:10],"big");cursor=10
 for _ in range(count):
  current=int.from_bytes(data[cursor:cursor+2],"big");size=int.from_bytes(data[cursor+3:cursor+7],"big")
  if current==tag:return data[:8]+(count-1).to_bytes(2,"big")+data[10:cursor]+data[cursor+7+size:]
  cursor+=7+size
 raise AssertionError(tag)
def negatives(signing,bridge):
 output=[]
 for label,base in (("signing",signing),("bridge",bridge)):
  for cut in range(len(base)):reject(f"{label}_truncated_at_{cut:04d}",base[:cut],output)
 item=bytearray(signing);item[0]^=1;reject("bad_magic",bytes(item),output);reject("trailing_byte",signing+b"\0",output);reject("wrong_schema_wire",mutate_field(signing,1,wire=BYTES),output);reject("ascii_129_global",mutate_field(signing,2,payload=b"a"*129),output);reject("zero_policy_version",mutate_field(signing,9,payload=bytes(8)),output)
 pol=policy();reject("policy_zero_version",mutate_field(pol,2,payload=bytes(8)),output);reject("policy_zero_subject_kind",mutate_field(pol,3,payload=b"\0"),output);reject("policy_wrong_subject_length",mutate_field(pol,4,payload=bytes(19)),output);reject("policy_zero_authorization_epoch",mutate_field(pol,5,payload=bytes(8)),output);reject("policy_zero_activation_height",mutate_field(pol,8,payload=bytes(8)),output);reject("policy_zero_minimum_footprint",mutate_field(pol,10,payload=bytes(4)),output)
 child=policy_node(1);invalid=raw_object(0x0051,[f_u8(1,3),f_object(2,encode_object(0x0054,[f_u8(1,2)])),f_object_list(3,[child])]);reject("threshold_k_exceeds_child_count",invalid,output)
 reg=registration();reject("registration_profile_material_mismatch",mutate_field(reg,3,payload=(1).to_bytes(2,"big")),output);reject("registration_activation_not_after_deadline",mutate_field(reg,7,payload=(100).to_bytes(8,"big")),output);reject("registration_policy_commitment_mismatch",mutate_field(reg,9,payload=bytes(64)),output);reject("registration_missing_policy_preimage",remove_field(reg,11),output)
 rot=rotation();reject("rotation_profile_material_mismatch",mutate_field(rot,3,payload=(1).to_bytes(2,"big")),output);reject("rotation_epoch_not_monotonic",mutate_field(rot,6,payload=(1).to_bytes(8,"big")),output);reject("rotation_activation_not_after_deadline",mutate_field(rot,8,payload=(100).to_bytes(8,"big")),output);reject("rotation_policy_commitment_mismatch",mutate_field(rot,10,payload=bytes(64)),output);reject("rotation_missing_policy_preimage",remove_field(rot,12),output)
 pm=policy_mutation();reject("policy_version_not_incremented",mutate_field(pm,6,payload=(1).to_bytes(8,"big")),output);reject("authorization_epoch_not_incremented",mutate_field(pm,9,payload=(1).to_bytes(8,"big")),output);reject("invalid_policy_mutation_operation",mutate_field(pm,3,payload=b"\0"),output);reject("unregistered_policy_mutation_operation",mutate_field(pm,3,payload=b"\x05"),output)
 prov=sample(0x0115);reject("provenance_proposed_role_mismatch",mutate_field(prov,4,payload=b"\x02"),output);reject("provenance_proposed_identity_mismatch",mutate_field(prov,5,payload=bytes.fromhex("aa"*32)),output);reject("provenance_missing_authorization_state",remove_field(prov,10),output);reject("provenance_add_nonzero_lifecycle",mutate_field(prov,11,payload=bytes.fromhex("aa"*64)),output)
 duplicate_issuer_state=raw_object(0x0111,[f_u64(1,1),f_object_list(2,[issuer(1),issuer(3)]),f_bytes(3,bytes(64)),f_bytes(4,bytes(64))]);reject("provenance_issuer_identity_reused_across_roles",duplicate_issuer_state,output)
 a=policy_node(1,signer=b"label-a",slot=1,key_fill=2);b=policy_node(1,signer=b"label-b",slot=2,key_fill=2);dupes=sorted_nodes([a,b]);dup_threshold=raw_object(0x0051,[f_u8(1,3),f_object(2,encode_object(0x0054,[f_u8(1,2)])),f_object_list(3,dupes)]);reject("threshold_duplicate_public_key_authority",dup_threshold,output)
 dis=disable();reject("disable_activation_not_after_deadline",mutate_field(dis,7,payload=(100).to_bytes(8,"big")),output);reject("disable_policy_commitment_mismatch",mutate_field(dis,6,payload=bytes(64)),output);reject("disable_missing_policy_preimage",remove_field(dis,11),output)
 rec=recovery();reject("recovery_profile_material_mismatch",mutate_field(rec,6,payload=(0x8001).to_bytes(2,"big")),output);reject("recovery_activation_not_after_deadline",mutate_field(rec,10,payload=(100).to_bytes(8,"big")),output);reject("recovery_policy_commitment_mismatch",mutate_field(rec,13,payload=bytes(64)),output);reject("recovery_missing_policy_preimage",remove_field(rec,15),output)
 reject("registration_unregistered_result_state",append_field(reg,f_bytes(12,bytes(64))),output)
 reject("rotation_unregistered_result_state",append_field(rot,f_bytes(13,bytes(64))),output)
 reject("disable_unregistered_result_state",append_field(dis,f_bytes(12,bytes(64))),output)
 reject("recovery_unregistered_result_state",append_field(rec,f_bytes(16,bytes(64))),output)
 attest=bridge_attestation();reject("bridge_transfer_id_mismatch",mutate_field(attest,2,payload=bytes(64)),output)
 fp=finality_profile();reject("finality_disable_not_after_activation",mutate_field(fp,8,payload=(1).to_bytes(8,"big")),output)
 rm=registry_mutation();reject("registry_define_has_prior_lifecycle",mutate_field(rm,5,payload=b"\x01"),output);reject("registry_define_profile_commitment_mismatch",mutate_field(rm,9,payload=bytes(64)),output);reject("registry_define_missing_profile_preimage",remove_field(rm,11),output)
 schedule=encode_object(0x0041,[f_u64(1,2),f_bytes(2,bytes(64)),f_u8(3,2),f_u16(4,1),f_u8(5,1),f_u8(6,2),f_u64(7,100),f_u64(8,86500),f_bytes(9,bytes(64)),f_u64(10,2)])
 reject("registry_schedule_illegal_experimental_disabled_edge",mutate_field(schedule,6,payload=b"\x04"),output);reject("registry_schedule_embeds_profile",append_field(schedule,f_object(11,registry_profile())),output)
 p1,p2=registry_profile(1,"PROFILE_1"),registry_profile(2,"PROFILE_2");l1,l2=registry_lifecycle(1),registry_lifecycle(2)
 def raw_registry_state(profiles,lifecycles):return raw_object(0x0042,[f_u64(1,1),f_object_list(2,profiles),f_object_list(3,lifecycles),f_bytes(4,bytes(64))])
 reject("registry_profiles_unsorted",raw_registry_state([p2,p1],[l1,l2]),output);reject("registry_lifecycles_unsorted",raw_registry_state([p1,p2],[l2,l1]),output);reject("registry_orphan_profile",raw_registry_state([p1,p2],[l1]),output);reject("registry_orphan_lifecycle",raw_registry_state([p1],[l1,l2]),output);reject("registry_empty_profile_name",raw_registry_state([mutate_field(p1,2,payload=b"")],[l1]),output)
 life=registry_lifecycle();reject("registry_schedule_height_state_mismatch",mutate_field(life,4,payload=b"\x02"),output)
 kp=key_params();reject("policy_key_not_active",mutate_field(kp,5,payload=b"\x01"),output)
 inc=inclusion_record();reject("inclusion_index_out_of_range",mutate_field(inc,3,payload=(1).to_bytes(8,"big")),output)
 env=provenance_envelope();reject("provenance_envelope_domain_mismatch",mutate_field(env,3,payload=(0x0031).to_bytes(2,"big")),output);reject("provenance_envelope_record_commitment_mismatch",mutate_field(env,4,payload=bytes(64)),output);reject("provenance_envelope_sequence_rewrap",mutate_field(env,7,payload=(2).to_bytes(8,"big")),output);reject("provenance_envelope_predecessor_rewrap",mutate_field(env,8,payload=bytes.fromhex("aa"*64)),output);reject("provenance_envelope_missing_statement",remove_field(env,10),output)
 state=subject_state();reject("subject_state_zero_lifecycle_sequence",mutate_field(state,8,payload=bytes(8)),output)
 validator_sequence=encode_object(0x001E,[f_u8(1,2),f_bytes(2,bytes(32)),f_u16(3,1),f_u16(4,1)]);decode_object(validator_sequence);reject("validator_sequence_legacy_20_byte_identity",mutate_field(validator_sequence,2,payload=bytes(20)),output)
 pending=pending_mutation();reject("pending_mutation_wrong_domain",mutate_field(pending,2,payload=(0x0004).to_bytes(2,"big")),output);reject("pending_mutation_wrong_transition",mutate_field(pending,8,payload=b"\x03"),output)
 cancel=cancellation();reject("cancellation_zero_pending_commitment",mutate_field(cancel,3,payload=bytes(64)),output)
 legacy_cancel=raw_object(0x0012,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_bytes(3,bytes.fromhex("71"*64)),f_u64(4,7),f_bytes(5,bytes(64)),f_bytes(6,bytes(64))]);reject("legacy_unbound_cancellation_sequence",legacy_cancel,output)
 legacy_activation=raw_object(0x0017,[f_u8(1,1),f_bytes(2,bytes.fromhex("11"*20)),f_bytes(3,bytes.fromhex("71"*64)),f_bytes(4,bytes(64)),f_u64(5,1000),f_bytes(6,bytes(64))]);reject("legacy_claimed_execution_height",legacy_activation,output)
 permit=permissionless_envelope();reject("permissionless_action_commitment_mismatch",mutate_field(permit,3,payload=bytes(64)),output)
 action=activation();action_commit=domain("LITHO_ACTIVATE_PENDING_MUTATION_V1",action);fee=fee_payment(action,bytes.fromhex("22"*20));fee_commit=domain("LITHO_FEE_PAYMENT_ACTION_V1",fee);subject=bytes.fromhex("11"*20);p=policy_for(1,subject,1);auth=authorization_for(1,subject,1,3,0x0017,fee_commit,p);mismatch=raw_object(0x001C,[f_object(1,action),f_u16(2,0x000d),f_bytes(3,action_commit),f_object(4,fee),f_object(5,auth)]);reject("permissionless_fee_payer_subject_mismatch",mismatch,output)
 gov=governance();reject("governance_zero_action",mutate_field(gov,2,payload=bytes(2)),output);reject("governance_zero_target",mutate_field(gov,3,payload=bytes(2)),output);reject("governance_emergency_flag_mismatch",mutate_field(gov,10,payload=b"\x01"),output)
 artifact=sample(0x0060);reject("unregistered_artifact_kind",mutate_field(artifact,1,payload=(0x1234).to_bytes(2,"big")),output)
 reason=sample(0x0066);reject("unregistered_security_reason",mutate_field(reason,1,payload=(8).to_bytes(2,"big")),output)
 emergency=emergency_authority_state();reject("emergency_zero_action_sequence",mutate_field(emergency,4,payload=bytes(8)),output);reject("emergency_authority_identity_mismatch",mutate_field(emergency,1,payload=bytes.fromhex("e3"*32)),output)
 return output
def main():
 VECTORS.mkdir(parents=True,exist_ok=True);objects={f"object_{t:04x}":sample(t) for t in sorted(SCHEMAS)};objects.update(policy_variants());golden=[]
 for name,encoded in objects.items():
  decoded=decode_object(encoded);golden.append({"name":name,"object_type":f"0x{decoded['object_type']:04x}","canonical_hex":encoded.hex(),"sha3_512":hashlib.sha3_512(encoded).hexdigest()})
 negative=negatives(signing_payload(),bridge_transfer());(VECTORS/"golden.json").write_text(json.dumps(golden,indent=2)+"\n",encoding="utf-8");(VECTORS/"negative.json").write_text(json.dumps(negative,indent=2)+"\n",encoding="utf-8");print(f"generated {len(golden)} golden and {len(negative)} negative vectors")
if __name__=="__main__":main()
