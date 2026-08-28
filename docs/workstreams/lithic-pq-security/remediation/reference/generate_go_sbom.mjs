import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const evidence=path.resolve(here,'..','evidence','dependency');
const baseline=path.resolve(evidence,'..','baseline','assembled-go.mod');
const source=fs.readFileSync(baseline,'utf8');
const requires=new Map();
for(const line of source.split(/\r?\n/)){
  const match=line.match(/^\s*([^\s/][^\s]*)\s+(v[^\s]+)(?:\s+\/\/.*)?$/);
  if(match&&!['module','go','toolchain'].includes(match[1]))requires.set(match[1],{version:match[2],replacement:null});
}
for(const line of source.split(/\r?\n/)){
  const match=line.match(/^\s*([^\s/][^\s]*)\s*(?:v[^\s]+\s*)?=>\s*([^\s]+)(?:\s+(v[^\s]+))?/);
  if(match&&requires.has(match[1])){const item=requires.get(match[1]);item.replacement=[match[2],match[3]].filter(Boolean).join(' ');if(match[3])item.version=match[3];}
}
const lines=[...requires.entries()].map(([module,value])=>`${module} ${value.version}${value.replacement?` => ${value.replacement}`:''}`);
const parse=(line)=>{
  const parts=line.trim().split(/\s+/); const module=parts[0];
  let version=parts[1] && parts[1]!==' =>' ? parts[1] : 'local';
  const arrow=parts.indexOf('=>'); let replacement=null;
  if(arrow>=0){replacement=parts.slice(arrow+1).join(' ');const rv=parts[arrow+2];if(rv?.startsWith('v'))version=rv;}
  const name=module.split('/').pop();
  const component={type:'library',name,group:module.slice(0,-name.length).replace(/\/$/,''),version,'bom-ref':`pkg:golang/${encodeURIComponent(module)}@${encodeURIComponent(version)}`,purl:`pkg:golang/${encodeURIComponent(module)}@${encodeURIComponent(version)}`};
  if(replacement)component.properties=[{name:'litho:go:replacement',value:replacement}];
  return component;
};
const components=lines.map(parse).sort((a,b)=>a.purl.localeCompare(b.purl));
const serial=crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0,32);
const bom={bomFormat:'CycloneDX',specVersion:'1.6',serialNumber:`urn:uuid:${serial.slice(0,8)}-${serial.slice(8,12)}-4${serial.slice(13,16)}-8${serial.slice(17,20)}-${serial.slice(20,32)}`,version:1,metadata:{tools:{components:[{type:'application',name:'litho-go-module-sbom-generator',version:'1.0.0'}]},component:{type:'application',name:'github.com/evmos/evmos/v20',version:'LITHO-PQ-PHASE0-R1-20260825'}},components};
fs.writeFileSync(path.join(evidence,'bom.cdx.json'),JSON.stringify(bom,null,2)+'\n',{encoding:'utf8'});
process.stdout.write(`generated CycloneDX 1.6 SBOM with ${components.length} selected modules\n`);
