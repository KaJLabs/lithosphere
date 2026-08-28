// Independently structured, schema-aware LCE1 R8 decoder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const W={u8:1,u16:2,u32:3,u64:4,u256:5,bool:6,bytes:16,ascii:17,obj:32,list:33};
const widths=new Map([[1,1],[2,2],[3,4],[4,8],[5,32],[6,1]]);
class DecodeFailure extends Error {}
const r=(wire,required=true,nested=null,list=null)=>({wire,required,nested,list});
const fields=(...entries)=>new Map(entries.map(([tag,...args])=>[tag,r(...args)]));

// Complete object/tag/wire registry, authored independently from the Python layout.
const S=new Map([
 [0x0001,fields([1,W.u16],[2,W.ascii],[3,W.u64],[4,W.bytes],[5,W.u16],[6,W.u16],[7,W.u8],[8,W.bytes],[9,W.u64],[10,W.bytes],[11,W.u64],[12,W.u64],[13,W.u64],[14,W.ascii],[15,W.u256],[16,W.u16],[17,W.bytes])],
 [0x0002,fields([1,W.obj,true,0x0001],[2,W.list,true,null,0x0003],[3,W.obj,true,0x0050])],
 [0x0003,fields([1,W.u8],[2,W.u16],[3,W.u64],[4,W.u16],[5,W.bytes],[6,W.bytes],[7,W.bytes])],
 [0x0004,fields([1,W.obj,true,0x0032],[2,W.obj,true,0x0032],[3,W.obj,true,0x0033],[4,W.u256],[5,W.bytes])],
 [0x0005,fields([1,W.obj,true,0x0032],[2,W.obj,true,0x0032],[3,W.bytes],[4,W.bytes],[5,W.obj,true,0x0033],[6,W.u256],[7,W.u64])],
 [0x0010,fields([1,W.u8],[2,W.bytes],[3,W.u16],[4,W.u16],[5,W.u64],[6,W.obj,true,0x0015],[7,W.u64],[8,W.u64],[9,W.bytes],[10,W.bytes],[11,W.obj,true,0x0050])],
 [0x0011,fields([1,W.u8],[2,W.bytes],[3,W.u16],[4,W.u16],[5,W.u64],[6,W.u64],[7,W.obj,true,0x0015],[8,W.u64],[9,W.u64],[10,W.bytes],[11,W.bytes],[12,W.obj,true,0x0050])],
 [0x0012,fields([1,W.u8],[2,W.bytes],[3,W.bytes],[5,W.bytes],[6,W.bytes])],
 [0x0013,fields([1,W.u8],[2,W.bytes],[3,W.u16],[4,W.u64],[5,W.bytes],[6,W.bytes],[7,W.u64],[8,W.bytes],[9,W.u64],[10,W.bytes],[11,W.obj,true,0x0050])],
 [0x0014,fields([1,W.u8],[2,W.bytes],[3,W.u64],[4,W.u16],[5,W.u64],[6,W.u16],[7,W.u16],[8,W.u64],[9,W.obj,true,0x0015],[10,W.u64],[11,W.u64],[12,W.bytes],[13,W.bytes],[14,W.bytes],[15,W.obj,true,0x0050])],
 [0x0015,fields([1,W.u16],[2,W.bytes])],
 [0x0016,fields([1,W.u8],[2,W.bytes],[3,W.u8],[4,W.u64],[5,W.bytes],[6,W.u64],[7,W.bytes],[8,W.u64],[9,W.u64],[10,W.u16],[11,W.u64],[12,W.u64],[13,W.u64],[14,W.u64],[15,W.bytes])],
 [0x0017,fields([1,W.u8],[2,W.bytes],[3,W.bytes],[4,W.bytes],[6,W.bytes])],
 [0x0018,fields([1,W.u8],[2,W.bytes],[3,W.u64],[4,W.bytes],[5,W.u64],[6,W.obj,false,0x001b],[7,W.list,true,null,0x0019],[8,W.u64])],
 [0x0019,fields([1,W.u16],[2,W.u64],[3,W.u16],[4,W.obj,true,0x0015],[5,W.u8],[6,W.bytes],[7,W.u64],[8,W.u64],[9,W.bytes])],
 [0x001a,fields([1,W.u64],[2,W.bytes],[3,W.u8],[4,W.bytes],[5,W.bytes],[6,W.u64],[7,W.bytes])],
 [0x001b,fields([1,W.u8],[2,W.u16],[3,W.bytes],[4,W.u16],[5,W.u64],[6,W.u64],[7,W.u64],[8,W.u8],[9,W.u64],[10,W.bytes],[11,W.u64],[12,W.bytes],[13,W.u64],[14,W.u8],[15,W.u16])],
 [0x001c,fields([1,W.obj,true,0x0017],[2,W.u16],[3,W.bytes],[4,W.obj,true,0x001d],[5,W.obj,true,0x0002])],
 [0x001d,fields([1,W.obj,true,0x0032],[2,W.u16],[3,W.bytes],[4,W.ascii],[5,W.u256])],
 [0x001e,fields([1,W.u8],[2,W.bytes],[3,W.u16],[4,W.u16])],
 [0x001f,fields([1,W.obj,true,0x001e],[2,W.u64],[3,W.u64],[4,W.bytes])],
 [0x0020,fields([1,W.u64],[2,W.u16],[3,W.u16],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.bytes],[8,W.u64],[9,W.u64],[10,W.bool])],
 [0x0030,fields([1,W.u16],[2,W.obj,true,0x0031],[3,W.obj,true,0x0031],[4,W.obj,true,0x0032],[5,W.obj,true,0x0032],[6,W.obj,true,0x0033],[7,W.obj,true,0x0033],[8,W.u256],[9,W.obj,true,0x0032],[10,W.obj,true,0x0032],[11,W.bytes],[12,W.u32],[13,W.u64])],
 [0x0031,fields([1,W.u8],[2,W.ascii],[3,W.bytes],[4,W.u64])],
 [0x0032,fields([1,W.u8],[2,W.bytes])],
 [0x0033,fields([1,W.obj,true,0x0031],[2,W.u8],[3,W.bytes],[4,W.bytes],[5,W.u8])],
 [0x0034,fields([1,W.bytes],[2,W.bytes],[3,W.u64],[4,W.bytes],[5,W.bytes],[6,W.u16],[7,W.bytes],[8,W.u64],[9,W.u64])],
 [0x0035,fields([1,W.obj,true,0x0030],[2,W.bytes],[3,W.bytes],[4,W.u16],[5,W.bytes],[6,W.bytes])],
 [0x0036,fields([1,W.u16],[2,W.obj,true,0x0031],[3,W.u8],[4,W.u64],[5,W.u8],[6,W.bytes],[7,W.u64],[8,W.u64])],
 [0x0040,fields([1,W.u16],[2,W.ascii],[3,W.bytes],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.u32],[8,W.u32],[9,W.bytes],[10,W.bytes],[11,W.u64])],
 [0x0041,fields([1,W.u64],[2,W.bytes],[3,W.u8],[4,W.u16],[5,W.u8],[6,W.u8],[7,W.u64],[8,W.u64],[9,W.bytes],[10,W.u64],[11,W.obj,false,0x0040])],
 [0x0042,fields([1,W.u64],[2,W.list,true,null,0x0040],[3,W.list,true,null,0x0044],[4,W.bytes])],
 [0x0043,fields([1,W.u64],[2,W.obj,true,0x0041],[3,W.bytes],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.u64],[8,W.u64])],
 [0x0044,fields([1,W.u16],[2,W.u8],[3,W.u64],[4,W.u8],[5,W.u64])],
 [0x0045,fields([1,W.u16],[2,W.bytes],[3,W.u64],[4,W.ascii])],
 [0x0046,fields([1,W.bytes],[2,W.obj,true,0x0050],[3,W.obj,true,0x0018],[4,W.u64],[5,W.bytes],[6,W.u64])],
 [0x0050,fields([1,W.bytes],[2,W.u64],[3,W.u8],[4,W.bytes],[5,W.u64],[6,W.obj,true,0x0051],[7,W.obj,false,0x0051],[8,W.u64],[9,W.bytes],[10,W.u32])],
 [0x0051,fields([1,W.u8],[2,W.obj],[3,W.list,false,null,0x0051])],
 [0x0052,fields([1,W.u16],[2,W.bytes],[3,W.u16],[4,W.u64],[5,W.u8],[6,W.bytes])],
 [0x0053,fields()], [0x0054,fields([1,W.u8])], [0x0055,fields([1,W.u64])],
 [0x0056,fields([1,W.bytes],[2,W.u8],[3,W.obj,true,0x0033],[4,W.u256],[5,W.u64],[6,W.u64],[7,W.u8])],
 [0x0060,fields([1,W.u16],[2,W.bytes],[3,W.u64],[4,W.ascii],[5,W.ascii,false])],
 [0x0061,fields([1,W.bytes],[2,W.u64],[3,W.u64],[4,W.bool],[5,W.list,true,null,0x0032])],
 [0x0062,fields([1,W.bytes],[2,W.u64],[3,W.u64],[4,W.u64],[5,W.list,true,null,0x0032])],
 [0x0063,fields([1,W.bytes],[2,W.bytes],[3,W.bytes],[4,W.u32],[5,W.bytes])],
 [0x0064,fields([1,W.bytes],[2,W.obj,true,0x0031],[3,W.obj,true,0x0031],[4,W.obj,true,0x0033],[5,W.obj,true,0x0033],[6,W.u256],[7,W.u16],[8,W.bytes])],
 [0x0065,fields([1,W.u16],[2,W.ascii],[3,W.bytes],[4,W.u32],[5,W.bytes])],
 [0x0066,fields([1,W.u16],[2,W.bytes],[3,W.u64])],
 [0x0100,fields([1,W.u64],[2,W.ascii],[3,W.ascii],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.bytes],[8,W.bytes],[9,W.bytes],[10,W.ascii],[11,W.bytes],[12,W.bytes],[13,W.u8],[14,W.u64])],
 [0x0101,fields([1,W.u64],[2,W.bytes],[3,W.bytes],[4,W.u16],[5,W.u16],[6,W.u16],[7,W.bytes],[8,W.bytes],[9,W.bytes],[10,W.bytes],[11,W.bytes],[12,W.bytes],[13,W.u32],[14,W.u32],[15,W.u8],[16,W.bytes],[17,W.bytes],[18,W.bytes],[19,W.u32])],
 [0x0102,fields([1,W.u64],[2,W.ascii],[3,W.bytes],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.ascii],[8,W.u8],[9,W.bytes],[10,W.u64])],
 [0x0103,fields([1,W.u64],[2,W.bytes],[3,W.bytes],[4,W.ascii],[5,W.u64],[6,W.bytes],[7,W.bytes],[8,W.bytes],[9,W.u64],[10,W.bytes],[11,W.u16],[12,W.bytes],[13,W.u64],[14,W.bytes],[15,W.bytes],[16,W.bytes],[17,W.bytes],[18,W.bytes])],
 [0x010e,fields([1,W.u16],[2,W.u16],[3,W.bytes],[4,W.u64],[5,W.bytes])],
 [0x010f,fields([1,W.u16],[2,W.obj],[3,W.u16],[4,W.bytes],[5,W.bytes],[6,W.u8],[7,W.u64],[8,W.bytes],[9,W.obj,true,0x0002],[10,W.obj,true,0x010e])],
 [0x0110,fields([1,W.bytes],[2,W.u8],[3,W.bytes],[4,W.u64],[5,W.u64],[6,W.u64],[7,W.u64],[8,W.bytes])],
 [0x0111,fields([1,W.u64],[2,W.list,true,null,0x0110],[3,W.bytes],[4,W.bytes])],
 [0x0112,fields([1,W.bytes],[2,W.u64],[3,W.bytes],[4,W.bytes],[5,W.u64],[6,W.u64],[7,W.u64])],
 [0x0113,fields([1,W.bytes],[2,W.u64],[3,W.u64],[4,W.bytes],[5,W.list,true,null,0x0114],[6,W.bytes])],
 [0x0114,fields([1,W.u8],[2,W.bytes])],
 [0x0115,fields([1,W.u64],[2,W.bytes],[3,W.u8],[4,W.u8],[5,W.bytes],[6,W.bytes],[7,W.obj,false,0x0110],[8,W.u64],[9,W.u64],[10,W.bytes,false],[11,W.bytes,false])],
 [0x0116,fields([1,W.u64],[2,W.obj,true,0x0115],[3,W.bytes],[4,W.bytes],[5,W.bytes],[6,W.bytes],[7,W.u64],[8,W.u64])],
 [0x0117,fields([1,W.bytes],[2,W.u64],[3,W.u64],[4,W.bytes],[5,W.bytes],[6,W.list,true,null,0x0118])],
 [0x0118,fields([1,W.bytes])],
]);

const E=new Map(Object.entries({
 '1:4':32,'1:10':64,'1:17':64,'3:6':64,'4:5':64,'5:3':4,'5:4':64,
 '16:9':64,'16:10':64,'17:10':64,'17:11':64,'18:3':64,'18:5':64,'18:6':64,'19:5':64,'19:6':64,'19:8':64,'19:10':64,'20:14':64,
 '20:12':64,'20:13':64,'22:5':64,'22:7':64,'22:15':64,'31:4':64,'32:5':64,'32:6':64,'32:7':64,
 '23:3':64,'23:4':64,'23:6':64,'24:4':64,'27:3':64,'27:10':64,'27:12':64,'28:3':64,'29:3':64,
 '25:6':64,'25:9':64,'26:2':64,'26:4':64,'26:5':64,'26:7':64,
 '48:11':32,'52:1':64,'52:2':32,'52:4':32,'52:7':32,'53:2':64,'53:3':64,'53:5':32,'53:6':64,'54:6':64,
 '64:3':32,'64:4':32,'64:5':64,'64:9':64,'64:10':64,'65:2':64,'65:9':64,'66:4':64,'67:3':64,'67:4':64,'67:5':64,'67:6':64,
 '69:2':32,'70:1':32,'70:5':64,
 '80:1':32,'80:9':64,'82:6':64,'86:1':32,
 '96:2':32,'97:1':64,'98:1':64,'99:1':64,'99:2':32,'99:3':64,'99:5':64,'100:1':32,'100:8':32,'101:3':64,'101:5':64,'102:2':64,
 '256:4':64,'256:5':64,'256:6':64,'256:7':64,'256:8':32,'256:9':64,'256:11':64,'256:12':64,
 '257:2':64,'257:3':64,'257:7':64,'257:8':64,'257:9':64,'257:10':64,'257:11':64,'257:12':64,'257:16':64,'257:17':32,'257:18':64,
 '258:3':64,'258:4':64,'258:5':64,'258:6':64,'258:9':64,'259:2':64,'259:3':64,'259:6':32,'259:8':32,'259:10':64,'259:12':64,'259:14':64,'259:15':64,'259:16':64,'259:17':64,'259:18':64,
 '270:3':64,'270:5':64,'271:4':64,'271:5':32,'271:8':64,'272:1':32,'272:3':64,'272:8':64,'273:3':64,'273:4':64,'274:1':32,'274:3':64,'274:4':64,'275:1':32,'275:4':64,'275:6':64,'276:2':64,
 '277:2':64,'277:5':32,'277:6':64,'277:10':64,'277:11':64,'278:3':64,'278:4':64,'278:5':64,'278:6':64,
 '279:1':32,'279:4':64,'279:5':64,'280:1':64,
 }));

const limits=new Map([[0x0001,4096],[0x0002,131072],[0x0003,32768],[0x0010,8192],[0x0011,8192],[0x0012,8192],[0x0013,8192],[0x0014,8192],[0x0017,8192],[0x001b,8192],[0x001c,131072],[0x001d,8192],[0x0030,16384],[0x0034,65536],[0x0046,65536],[0x0100,65536],[0x0101,65536],[0x0102,65536],[0x0103,65536],[0x010f,131072],[0x0112,65536],[0x0113,65536],[0x0117,65536]]);

function n(field){return Number(field.numeric);}
function len(field){return field.payload.length;}
function exact(field,size){if(len(field)!==size)throw new DecodeFailure('exact length');}

function semantic(object){
 const t=object.type,f=new Map(object.fields.map(x=>[x.tag,x]));
 const proposedPolicy=(commitTag,policyTag)=>{const p=f.get(policyTag),pf=new Map(p.nested.fields.map(x=>[x.tag,x])),expected=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_POLICY_STATE_V1\0','ascii'),p.nested.raw])).digest();if(!expected.equals(f.get(commitTag).payload))throw new DecodeFailure('proposed policy commitment');if(n(pf.get(3))!==n(f.get(1))||!pf.get(4).payload.equals(f.get(2).payload))throw new DecodeFailure('proposed policy subject');};
 for(const [key,size] of E){const [ot,tag]=key.split(':').map(Number);if(ot===t&&f.has(tag))exact(f.get(tag),size);}
 if(t===0x0001){if(n(f.get(1))!==1||n(f.get(3))===0||n(f.get(7))<1||n(f.get(7))>6||n(f.get(9))===0||n(f.get(11))===0)throw new DecodeFailure('signing scalar'); exact(f.get(4),32);exact(f.get(10),64);exact(f.get(17),64);if(len(f.get(2))<1||len(f.get(2))>64||len(f.get(14))<1||len(f.get(14))>32)throw new DecodeFailure('signing text');}
 if(t===0x0010){const m=new Map(f.get(6).nested.fields.map(x=>[x.tag,x]));if(n(f.get(3))!==n(m.get(1))||n(f.get(4))===0||n(f.get(5))===0||n(f.get(7))<=n(f.get(8)))throw new DecodeFailure('registration');proposedPolicy(9,11);}
 if(t===0x0011){const m=new Map(f.get(7).nested.fields.map(x=>[x.tag,x]));if(n(f.get(3))!==n(m.get(1))||n(f.get(4))===0||n(f.get(6))<=n(f.get(5))||n(f.get(8))<=n(f.get(9)))throw new DecodeFailure('rotation');proposedPolicy(10,12);}
 if(t===0x0012){if(!f.get(3).payload.some(x=>x!==0))throw new DecodeFailure('cancellation');}
 if(t===0x0013){if(n(f.get(3))===0||n(f.get(4))===0||n(f.get(7))<=n(f.get(9)))throw new DecodeFailure('disable');proposedPolicy(6,11);}
 if(t===0x0014){const m=new Map(f.get(9).nested.fields.map(x=>[x.tag,x]));if(n(f.get(6))!==n(m.get(1))||n(f.get(7))===0||n(f.get(8))<=n(f.get(5))||n(f.get(10))<=n(f.get(11)))throw new DecodeFailure('recovery');proposedPolicy(13,15);}
 if(t===0x0016){if(n(f.get(3))<1||n(f.get(3))>4||n(f.get(6))!==n(f.get(4))+1||n(f.get(9))!==n(f.get(8))+1||n(f.get(12))<=n(f.get(11)))throw new DecodeFailure('policy mutation');}
 if(t===0x0020){const action=n(f.get(2)),target=n(f.get(3)),emergency=f.get(10).payload[0]===1;if(action<1||action>4||target<1||target>5||len(f.get(4))!==(target===3?64:32)||emergency!==(action===4)||(action===4&&target!==2))throw new DecodeFailure('governance semantics');}
 if(t===0x0002){const entries=f.get(2).nested;if(entries.length<1||entries.length>16)throw new DecodeFailure('signature count');const order=entries.map(e=>{const q=new Map(e.fields.map(x=>[x.tag,x]));return `${q.get(5).payload.toString('hex')}:${n(q.get(2)).toString().padStart(5,'0')}:${n(q.get(3)).toString().padStart(20,'0')}:${n(q.get(4)).toString().padStart(5,'0')}`;});if(order.join('|')!==[...new Set(order)].sort().join('|'))throw new DecodeFailure('signature order');}
 if(t===0x0003){const sizes=new Map([[0x0101,3309],[0x0102,4627],[0x0201,29792],[0x8001,65]]);if(![1,2].includes(n(f.get(1)))||n(f.get(2))===0||n(f.get(3))===0||!sizes.has(n(f.get(4)))||len(f.get(7))!==sizes.get(n(f.get(4))))throw new DecodeFailure('signature');exact(f.get(6),64);}
 if(t===0x0015){const sizes=new Map([[0x0101,1952],[0x0102,2592],[0x0201,64],[0x8001,33]]);if(!sizes.has(n(f.get(1)))||len(f.get(2))!==sizes.get(n(f.get(1))))throw new DecodeFailure('public key');}
 if(t===0x001e){const sizes=new Map([[1,20],[2,32],[3,20],[4,32],[5,32],[6,32]]);if(!sizes.has(n(f.get(1)))||len(f.get(2))!==sizes.get(n(f.get(1)))||n(f.get(3))===0||n(f.get(4))===0)throw new DecodeFailure('authorization sequence key');}
 if(t===0x001f){if(n(f.get(2))===0||n(f.get(3))===0)throw new DecodeFailure('authorization sequence state');}
 if(t===0x0031){const ns=n(f.get(1)),evm=n(f.get(4));exact(f.get(3),32);if(![1,2,3].includes(ns)||len(f.get(2))<1||len(f.get(2))>64||(ns===1&&evm!==0)||(ns!==1&&evm===0))throw new DecodeFailure('chain');}
 if(t===0x0032){const sizes=new Map([[1,20],[2,20],[3,20],[4,32],[5,32]]);if(!sizes.has(n(f.get(1)))||len(f.get(2))!==sizes.get(n(f.get(1))))throw new DecodeFailure('principal');}
 if(t===0x0033){const ns=n(f.get(2)),a=len(f.get(3)),b=len(f.get(4));const ok=(ns===1&&a===0&&b>=1&&b<=64)||(ns===2&&a===20&&b===0)||(ns===3&&a===32&&b===32)||(ns===4&&[20,32].includes(a)&&b>=1&&b<=64);if(!ok||n(f.get(5))>38)throw new DecodeFailure('asset');}
 if(t===0x0030){if(n(f.get(1))!==1||n(f.get(8))===0||n(f.get(13))===0)throw new DecodeFailure('bridge');exact(f.get(11),32);}
 if(t===0x0034){exact(f.get(1),64);exact(f.get(2),32);exact(f.get(4),32);exact(f.get(7),32);if(n(f.get(3))===0||n(f.get(8))<n(f.get(3)))throw new DecodeFailure('inclusion');}
 if(t===0x0035){const transfer=f.get(1).nested.raw,id=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_BRIDGE_TRANSFER_V1\0','ascii'),transfer])).digest();if(!id.equals(f.get(2).payload))throw new DecodeFailure('transfer ID');}
 if(t===0x0036){if(n(f.get(1))===0||![1,2,3].includes(n(f.get(3)))||(n(f.get(8))!==0&&n(f.get(8))<=n(f.get(7)))||(n(f.get(3))===3&&n(f.get(4))===0))throw new DecodeFailure('finality');}
 if(t===0x0050){const sizes=new Map([[1,20],[2,32],[3,20],[4,32],[5,32],[6,32]]),kind=n(f.get(3));if(n(f.get(2))===0||!sizes.has(kind)||len(f.get(4))!==sizes.get(kind)||n(f.get(5))===0||n(f.get(8))===0||n(f.get(10))===0)throw new DecodeFailure('policy local invariants');}
 if(t===0x0051){const kind=n(f.get(1)),rules=new Map([[1,[0x0052,0,0]],[2,[0x0053,2,16]],[3,[0x0054,1,16]],[4,[0x0055,1,1]],[5,[0x0056,1,1]]]);const rule=rules.get(kind),params=f.get(2).nested,kids=f.get(3)?.nested??[];if(!rule||params.type!==rule[0]||kids.length<rule[1]||kids.length>rule[2])throw new DecodeFailure('policy node');const hashes=kids.map(k=>crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_POLICY_NODE_V1\0','ascii'),k.raw])).digest('hex'));if(hashes.join('|')!==[...new Set(hashes)].sort().join('|'))throw new DecodeFailure('policy child order');if(kind===3){const threshold=new Map(params.fields.map(x=>[x.tag,x]));if(n(threshold.get(1))>kids.length)throw new DecodeFailure('threshold exceeds child count');}if([2,3].includes(kind)){const auth=[];const walk=x=>{const q=new Map(x.fields.map(y=>[y.tag,y])),k=n(q.get(1));if(k===1){const p=new Map(q.get(2).nested.fields.map(y=>[y.tag,y]));auth.push(p.get(6).payload.toString('hex'));}else for(const c of q.get(3)?.nested??[])walk(c);};for(const c of kids)walk(c);if(auth.length!==new Set(auth).size)throw new DecodeFailure('duplicate authority');}}
 if(t===0x0054&&n(f.get(1))===0)throw new DecodeFailure('threshold');
 if(t===0x0056){exact(f.get(1),32);if(![1,2,3].includes(n(f.get(2)))||n(f.get(4))===0||n(f.get(5))===0||![1,2,3].includes(n(f.get(7))))throw new DecodeFailure('rate');}
 if(t===0x0052&&(n(f.get(1))===0||n(f.get(3))===0||n(f.get(4))===0||n(f.get(5))!==4))throw new DecodeFailure('key params');
 if(t===0x0040){if(n(f.get(1))===0||n(f.get(11))===0||len(f.get(2))<1||len(f.get(2))>64)throw new DecodeFailure('profile definition');}
 if(t===0x0042){const profiles=f.get(2).nested.map(x=>n(new Map(x.fields.map(y=>[y.tag,y])).get(1))),lifecycles=f.get(3).nested.map(x=>n(new Map(x.fields.map(y=>[y.tag,y])).get(1)));const canonical=x=>x.length>0&&x.join('|')===[...new Set(x)].sort((a,b)=>a-b).join('|');if(!canonical(profiles)||!canonical(lifecycles)||profiles.join('|')!==lifecycles.join('|'))throw new DecodeFailure('registry profile lifecycle bijection');}
 if(t===0x0041){const op=n(f.get(3)),target=n(f.get(4)),prior=n(f.get(5)),requested=n(f.get(6)),scheduled=n(f.get(7)),activation=n(f.get(8)),profile=f.get(11),zero=!f.get(9).payload.some(x=>x!==0);if(![1,2,3,4].includes(op)||target===0||scheduled===0||n(f.get(1))===0||n(f.get(10))===0)throw new DecodeFailure('registry mutation common');if(op===1){if(prior!==0||requested!==1||activation!==scheduled||!profile)throw new DecodeFailure('registry define matrix');const pf=new Map(profile.nested.fields.map(x=>[x.tag,x])),expected=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_CRYPTO_PROFILE_DEFINITION_V1\0','ascii'),profile.nested.raw])).digest();if(n(pf.get(1))!==target||n(pf.get(11))!==scheduled||zero||!f.get(9).payload.equals(expected))throw new DecodeFailure('registry define profile');}else if(op===2){if(profile||!zero||!["1:2","2:3","3:4"].includes(`${prior}:${requested}`)||activation<=scheduled)throw new DecodeFailure('registry schedule matrix');}else if(op===3){if(profile||!zero||![1,2,3].includes(prior)||requested!==0||activation!==0)throw new DecodeFailure('registry cancel matrix');}else if(profile||!zero||![1,2,3].includes(prior)||requested!==4||activation<=scheduled)throw new DecodeFailure('registry emergency matrix');}
 if(t===0x0044){const state=n(f.get(2)),next=n(f.get(4)),height=n(f.get(5)),edges=new Set(['1:2','1:4','2:3','2:4','3:4']);if(![1,2,3,4].includes(state)||((next===0)!==(height===0))||(next!==0&&!edges.has(`${state}:${next}`)))throw new DecodeFailure('lifecycle');}
 if(t===0x0060){const kind=n(f.get(1)),valid=(kind>=1&&kind<=0x13)||kind===0x20||kind===0x21;if(!valid||n(f.get(3))===0||len(f.get(4))<1||len(f.get(4))>64)throw new DecodeFailure('artifact');}
 if([0x0061,0x0062].includes(t)){if(n(f.get(2))===0||n(f.get(3))===0)throw new DecodeFailure('authority state');const principals=f.get(5).nested.map(x=>x.raw.toString('hex'));if(principals.length===0||principals.join('|')!==[...new Set(principals)].sort().join('|'))throw new DecodeFailure('principal order');}
 if(t===0x0064&&(n(f.get(6))===0||n(f.get(7))===0))throw new DecodeFailure('route');
 if(t===0x0065&&(n(f.get(1))===0||n(f.get(4))===0||len(f.get(2))<1||len(f.get(2))>64))throw new DecodeFailure('proof format');
 if(t===0x0066&&(n(f.get(1))<1||n(f.get(1))>7))throw new DecodeFailure('reason');
 if(t===0x010e){if(![0x0100,0x0101,0x0102,0x0103].includes(n(f.get(1)))||![0x0030,0x0031,0x0032,0x0033].includes(n(f.get(2)))||n(f.get(4))===0)throw new DecodeFailure('provenance statement');}
 if(t===0x010f){const records=new Map([[0x0100,[0x0030,'LITHO_BUILD_PROVENANCE_V1',1,1]],[0x0101,[0x0031,'LITHO_COMPILER_MANIFEST_V1',2,2]],[0x0102,[0x0032,'LITHO_AUDIT_REVIEW_V1',3,3]],[0x0103,[0x0033,'LITHO_DEPLOYMENT_ATTESTATION_V1',4,4]]]),rt=n(f.get(1)),rule=records.get(rt);if(!rule||f.get(2).nested.type!==rt||n(f.get(3))!==rule[0]||n(f.get(6))!==rule[2])throw new DecodeFailure('provenance dispatch');const commit=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from(`${rule[1]}\0`,'ascii'),f.get(2).nested.raw])).digest();if(!commit.equals(f.get(4).payload))throw new DecodeFailure('record commitment');const statement=new Map(f.get(10).nested.fields.map(x=>[x.tag,x]));if(n(statement.get(1))!==rt||n(statement.get(2))!==rule[0]||!statement.get(3).payload.equals(commit)||n(statement.get(4))!==n(f.get(7))||!statement.get(5).payload.equals(f.get(8).payload))throw new DecodeFailure('provenance statement binding');const statementCommit=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_PROVENANCE_STATEMENT_V1\0','ascii'),f.get(10).nested.raw])).digest(),auth=new Map(f.get(9).nested.fields.map(x=>[x.tag,x])),payload=new Map(auth.get(1).nested.fields.map(x=>[x.tag,x])),policy=new Map(auth.get(3).nested.fields.map(x=>[x.tag,x])),recordFields=new Map(f.get(2).nested.fields.map(x=>[x.tag,x]));if(n(payload.get(5))!==6||n(payload.get(6))!==rule[3]||n(payload.get(7))!==6||!payload.get(8).payload.equals(f.get(5).payload)||n(payload.get(16))!==0x003b||!payload.get(17).payload.equals(statementCommit)||n(payload.get(12))!==n(f.get(7))||n(recordFields.get(1))!==n(f.get(7))||n(policy.get(3))!==6||!policy.get(4).payload.equals(f.get(5).payload))throw new DecodeFailure('provenance authorization');const pc=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_POLICY_STATE_V1\0','ascii'),auth.get(3).nested.raw])).digest();if(!pc.equals(payload.get(10).payload))throw new DecodeFailure('provenance policy');}
 if(t===0x0017){if(!f.get(3).payload.some(x=>x!==0))throw new DecodeFailure('activation');}
 if(t===0x0018){if(n(f.get(3))===0||n(f.get(5))===0||n(f.get(8))===0)throw new DecodeFailure('authorization state');if(f.has(6)){const p=new Map(f.get(6).nested.fields.map(x=>[x.tag,x]));if(n(p.get(9))!==n(f.get(3))+1||n(p.get(11))!==n(f.get(5))+1)throw new DecodeFailure('pending counters');}const keys=f.get(7).nested,order=keys.map(k=>{const q=new Map(k.fields.map(x=>[x.tag,x]));return `${n(q.get(1)).toString().padStart(5,'0')}:${n(q.get(2)).toString().padStart(20,'0')}`;});if(keys.length===0||order.join('|')!==[...new Set(order)].sort().join('|'))throw new DecodeFailure('key order');}
 if(t===0x001a){if(n(f.get(1))===0||n(f.get(3))<1||n(f.get(3))>6||n(f.get(6))===0)throw new DecodeFailure('lifecycle record');}
 if(t===0x001b){const op=n(f.get(1)),domains=new Map([[1,4],[2,5],[3,7],[4,8]]),results=new Map([[1,4],[2,4],[3,6],[4,4]]),proposed=f.get(12).payload.some(x=>x!==0),prior=n(f.get(13)),priorSlot=n(f.get(15));if(!domains.has(op)||n(f.get(2))!==domains.get(op)||n(f.get(8))!==op||n(f.get(14))!==results.get(op)||n(f.get(4))===0||n(f.get(5))===0||n(f.get(6))<=n(f.get(7))||n(f.get(9))===0||n(f.get(11))===0||(op===3&&proposed)||(op!==3&&!proposed)||((op===1)!==(prior===0))||((op===1)!==(priorSlot===0))||([2,3].includes(op)&&priorSlot!==n(f.get(4)))||(op===4&&priorSlot===0))throw new DecodeFailure('pending mutation');}
 if(t===0x001d){const payer=new Map(f.get(1).nested.fields.map(x=>[x.tag,x]));if(![1,2].includes(n(payer.get(1)))||n(f.get(2))!==0x000d||!f.get(3).payload.some(x=>x!==0)||len(f.get(4))<1||len(f.get(4))>32)throw new DecodeFailure('fee payment');}
 if(t===0x001c){const actionCommit=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_ACTIVATE_PENDING_MUTATION_V1\0','ascii'),f.get(1).nested.raw])).digest(),feeCommit=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_FEE_PAYMENT_ACTION_V1\0','ascii'),f.get(4).nested.raw])).digest(),fee=new Map(f.get(4).nested.fields.map(x=>[x.tag,x])),payer=new Map(fee.get(1).nested.fields.map(x=>[x.tag,x])),auth=new Map(f.get(5).nested.fields.map(x=>[x.tag,x])),payload=new Map(auth.get(1).nested.fields.map(x=>[x.tag,x]));if(n(f.get(2))!==0x000d||!f.get(3).payload.equals(actionCommit)||!fee.get(3).payload.equals(actionCommit)||n(payload.get(5))!==1||n(payload.get(6))!==3||n(payload.get(7))!==1||!payload.get(8).payload.equals(payer.get(2).payload)||n(payload.get(16))!==0x0017||!payload.get(17).payload.equals(feeCommit)||!payload.get(14).payload.equals(fee.get(4).payload)||BigInt(payload.get(15).numeric)>BigInt(fee.get(5).numeric))throw new DecodeFailure('permissionless envelope');}
 if(t===0x0019){if(n(f.get(1))===0||n(f.get(2))===0||n(f.get(5))<1||n(f.get(5))>7)throw new DecodeFailure('key state');const material=new Map(f.get(4).nested.fields.map(x=>[x.tag,x]));if(n(material.get(1))!==n(f.get(3)))throw new DecodeFailure('key profile');}
 if(t===0x0045){if(![1,2,3].includes(n(f.get(1)))||n(f.get(3))===0||len(f.get(4))<1||len(f.get(4))>64)throw new DecodeFailure('profile artifact');}
 if(t===0x0046){const authority=f.get(1).payload,policy=new Map(f.get(2).nested.fields.map(x=>[x.tag,x])),state=new Map(f.get(3).nested.fields.map(x=>[x.tag,x]));if(!authority.some(x=>x!==0)||n(f.get(4))===0||n(f.get(6))===0||n(policy.get(3))!==4||!policy.get(4).payload.equals(authority)||policy.has(7))throw new DecodeFailure('emergency identity');const policyCommit=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_POLICY_STATE_V1\0','ascii'),f.get(2).nested.raw])).digest();if(n(state.get(1))!==4||!state.get(2).payload.equals(authority)||n(policy.get(2))!==n(state.get(3))||n(policy.get(5))!==n(state.get(5))||!state.get(4).payload.equals(policyCommit))throw new DecodeFailure('emergency state binding');const root=new Map(policy.get(6).nested.fields.map(x=>[x.tag,x])),params=new Map(root.get(2).nested.fields.map(x=>[x.tag,x])),children=root.get(3)?.nested??[];if(n(root.get(1))!==3||n(params.get(1))!==2||children.length!==3)throw new DecodeFailure('emergency threshold');const stateKeys=new Map();for(const item of state.get(7).nested){const k=new Map(item.fields.map(x=>[x.tag,x]));if(n(k.get(5))===4)stateKeys.set(n(k.get(1)),k);}if([...stateKeys.keys()].sort().join(',')!=='1,2,3')throw new DecodeFailure('emergency slots');const slots=[],signers=[],commitments=[],profiles=[];for(const child of children){const c=new Map(child.fields.map(x=>[x.tag,x])),kp=new Map(c.get(2).nested.fields.map(x=>[x.tag,x])),slot=n(kp.get(3)),sk=stateKeys.get(slot);if(n(c.get(1))!==1||![0x0201,0x0102].includes(n(kp.get(1)))||n(kp.get(5))!==4||!sk||n(sk.get(2))!==n(kp.get(4))||n(sk.get(3))!==n(kp.get(1)))throw new DecodeFailure('emergency key state');const expected=crypto.createHash('sha3-512').update(Buffer.concat([Buffer.from('LITHO_PUBLIC_KEY_COMMITMENT_V1\0','ascii'),sk.get(4).nested.raw])).digest();if(!kp.get(6).payload.equals(expected))throw new DecodeFailure('emergency key commitment');slots.push(slot);signers.push(kp.get(2).payload.toString('hex'));commitments.push(kp.get(6).payload.toString('hex'));profiles.push(n(kp.get(1)));}if([...new Set(slots)].sort().join(',')!=='1,2,3'||new Set(signers).size!==3||new Set(commitments).size!==3||new Set(profiles).size!==1)throw new DecodeFailure('emergency distinctness');}
 if(t===0x0115){const op=n(f.get(3)),has=f.has(7),hasState=f.has(10),hasLifecycle=f.has(11),priorNonZero=f.get(6).payload.some(x=>x!==0);if(![1,2,3].includes(op)||n(f.get(4))<1||n(f.get(4))>6||n(f.get(8))===0||n(f.get(9))===0||(op!==3)!==has||(op!==3)!==hasState||(op!==3)!==hasLifecycle||(op===1&&priorNonZero)||(op!==1&&!priorNonZero))throw new DecodeFailure('provenance mutation');if(has){const i=new Map(f.get(7).nested.fields.map(x=>[x.tag,x]));if(n(i.get(2))!==n(f.get(4))||!i.get(1).payload.equals(f.get(5).payload)||n(i.get(6))!==n(f.get(8))||(op===1&&(n(i.get(4))!==1||n(i.get(5))!==1||f.get(11).payload.some(x=>x!==0)))||(op===2&&(n(i.get(4))<2||n(i.get(5))<2||!f.get(11).payload.some(x=>x!==0))))throw new DecodeFailure('provenance target/lifecycle');}}
 if(t===0x0110){if(n(f.get(2))<1||n(f.get(2))>6||n(f.get(4))===0||n(f.get(5))===0||n(f.get(6))===0||(n(f.get(7))!==0&&n(f.get(7))<=n(f.get(6))))throw new DecodeFailure('issuer');}
 if(t===0x0111){const issuers=f.get(2).nested,ids=issuers.map(x=>new Map(x.fields.map(y=>[y.tag,y])).get(1).payload.toString('hex')),order=issuers.map(x=>{const q=new Map(x.fields.map(y=>[y.tag,y]));return `${n(q.get(2)).toString().padStart(3,'0')}:${q.get(1).payload.toString('hex')}`;});if(ids.length!==new Set(ids).size||order.join('|')!==[...order].sort().join('|'))throw new DecodeFailure('issuer separation');}
 if(t===0x0117){const old=n(f.get(2)),next=n(f.get(3)),proof=f.get(6).nested;if(old>next||proof.length>64||(old===next&&proof.length!==0)||(old>0&&old<next&&proof.length===0))throw new DecodeFailure('consistency');}
 if(t===0x0113){const size=n(f.get(2)),index=n(f.get(3));if(size===0||index>=size||f.get(5).nested.length>64)throw new DecodeFailure('inclusion bounds');}
 if(t===0x0114){if(![1,2].includes(n(f.get(1))))throw new DecodeFailure('side');exact(f.get(2),64);}
}

function decodeList(buffer,depth){if(depth>8||buffer.length<2)throw new DecodeFailure('list');const count=buffer.readUInt16BE(0);if(count>128)throw new DecodeFailure('count');let p=2;const out=[];for(let i=0;i<count;i++){if(p+4>buffer.length)throw new DecodeFailure('list header');const size=buffer.readUInt32BE(p);p+=4;if(size===0||p+size>buffer.length)throw new DecodeFailure('list size');out.push(decode(buffer.subarray(p,p+size),depth));p+=size;}if(p!==buffer.length)throw new DecodeFailure('list trailing');return out;}

function decode(buffer,depth=1){
 if(depth>8||buffer.length<10||buffer.length>1_048_576||buffer.subarray(0,4).toString('ascii')!=='LCE1')throw new DecodeFailure('header');
 const type=buffer.readUInt16BE(4),version=buffer.readUInt16BE(6),count=buffer.readUInt16BE(8),schema=S.get(type);if(!schema||version!==1||count>64||buffer.length>(limits.get(type)??1_048_576))throw new DecodeFailure('schema');
 let p=10,previous=0;const decoded=[];
 for(let i=0;i<count;i++){if(p+7>buffer.length)throw new DecodeFailure('field header');const tag=buffer.readUInt16BE(p),wire=buffer[p+2],size=buffer.readUInt32BE(p+3);p+=7;if(tag===0||tag<=previous||!schema.has(tag)||p+size>buffer.length)throw new DecodeFailure('field');const rule=schema.get(tag),payload=buffer.subarray(p,p+size);if(wire!==rule.wire)throw new DecodeFailure('wire');if(widths.has(wire)&&size!==widths.get(wire))throw new DecodeFailure('width');if(wire===W.bool&&![0,1].includes(payload[0]))throw new DecodeFailure('bool');if(wire===W.bytes&&size>65536)throw new DecodeFailure('bytes');if(wire===W.ascii&&(size>128||[...payload].some(v=>v<0x21||v>0x7e)))throw new DecodeFailure('ascii');let nested=null;if(wire===W.obj)nested=decode(payload,depth+1);if(wire===W.list)nested=decodeList(payload,depth+1);if(rule.nested!==null&&nested.type!==rule.nested)throw new DecodeFailure('child');if(rule.list!==null&&nested.some(x=>x.type!==rule.list))throw new DecodeFailure('list child');let numeric=null;if(widths.has(wire)&&wire!==W.bool){numeric=payload.length<=6?payload.readUIntBE(0,payload.length):BigInt(`0x${payload.toString('hex')||'0'}`);}decoded.push({tag,wire,payload,nested,numeric});p+=size;previous=tag;}
 if(p!==buffer.length)throw new DecodeFailure('trailing');const present=new Set(decoded.map(x=>x.tag));for(const [tag,rule] of schema){if(rule.required&&!present.has(tag))throw new DecodeFailure('missing');}
 const object={type,version,fields:decoded,raw:buffer};semantic(object);return object;
}

const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.resolve(here,'..','vectors');
const golden=JSON.parse(fs.readFileSync(path.join(dir,'golden.json'),'utf8')),negative=JSON.parse(fs.readFileSync(path.join(dir,'negative.json'),'utf8'));
for(const vector of golden)decode(Buffer.from(vector.canonical_hex,'hex'));
for(const vector of negative){let rejected=false;try{decode(Buffer.from(vector.canonical_hex,'hex'));}catch(error){if(!(error instanceof DecodeFailure))throw error;rejected=true;}if(!rejected)throw new Error(`negative accepted: ${vector.name}`);}
process.stdout.write(`independent schema decoder accepted ${golden.length} golden and rejected ${negative.length} negative vectors\n`);
