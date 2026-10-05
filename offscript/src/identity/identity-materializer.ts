import fs from 'node:fs';import {createHash,randomUUID} from 'node:crypto';import {join,dirname,relative,resolve,sep} from 'node:path';
import {deriveBrandContract} from '../brand-contract.js';import {parseBrandKit} from '../brand-kit.js';import {parseBrief} from '../generate/brief.js';
import {assertIdentitySnapshot,immutableIdentityCopy} from './identity.js';import {assertUnlinked,checkedAssetPath} from './fs-safety.js';import type {ApprovedIdentity} from './types.js';
const markerName='.offscript-identity.json',lockName='.offscript-identity.lock';
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
interface Marker {schemaVersion:1;identity:ApprovedIdentity;managed:Record<string,string>}
function identityFiles(identity:ApprovedIdentity,readAsset:(path:string)=>Uint8Array):Record<string,Buffer>{
 assertIdentitySnapshot(identity);
 const files:Record<string,Buffer>={};
 for(const asset of identity.assets){
  if(['brief.md','colors_and_type.css','voice.md','brand-contract.json','brand-kit.json',markerName,lockName].includes(asset.path.toLowerCase())||asset.path.split('/').some(p=>p.startsWith('.offscript-identity')))throw new Error('identity: protected asset collision');
  const bytes=Buffer.from(readAsset(asset.path));if(hash(bytes)!==asset.digest)throw new Error(`identity: asset bytes mismatch ${asset.path}`);files[asset.path]=bytes;
 }
 files['colors_and_type.css']=Buffer.from(identity.css);files['voice.md']=Buffer.from(identity.voice);
 const contract=identity.brandContractJson??JSON.stringify(deriveBrandContract(identity.css,{subject:identity.subject,now:()=>new Date(identity.approval.at)}),null,2)+'\n';
 files['brand-contract.json']=Buffer.from(contract);
 const light=identity.assets.find(a=>a.role==='logo-light'),dark=identity.assets.find(a=>a.role==='logo-dark');
 if(light&&dark){const kit=JSON.stringify({schemaVersion:1,subject:identity.subject,logo:{lightSurfaceMark:light.path,darkSurfaceMark:dark.path},voiceReference:'voice.md',...(identity.imageryManifest?{imageryManifest:identity.imageryManifest}:{})},null,2)+'\n';parseBrandKit(kit);files['brand-kit.json']=Buffer.from(kit);}
 return files;
}
function readMarker(referencesDir:string):Marker|undefined{
 assertUnlinked(referencesDir);const path=join(referencesDir,markerName);assertUnlinked(path);if(!fs.existsSync(path))return undefined;
 const marker=JSON.parse(fs.readFileSync(path,'utf8')) as Marker;
 if(marker.schemaVersion!==1||!marker.managed||typeof marker.managed!=='object'||Array.isArray(marker.managed))throw new Error('identity: invalid installed marker');
 const files=identityFiles(marker.identity,p=>fs.readFileSync(checkedAssetPath(referencesDir,p)));
 if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify(Object.keys(marker.managed).sort()))throw new Error('identity: managed inventory mismatch');
 for(const [name,content] of Object.entries(files)){
  if(marker.managed[name]!==hash(content)||hash(fs.readFileSync(checkedAssetPath(referencesDir,name)))!==hash(content))throw new Error(`identity: installed bytes changed ${name}`);
 }
 return marker;
}
export function readInstalledIdentity(referencesDir:string):ApprovedIdentity|undefined{
 assertUnlinked(join(referencesDir,lockName));if(fs.existsSync(join(referencesDir,lockName)))throw new Error('identity: installation in progress');
 const marker=readMarker(referencesDir);return marker?immutableIdentityCopy(marker.identity):undefined;
}
export function materializeIdentity(identity:ApprovedIdentity,sourceRoot:string,referencesDir:string):void{
 assertUnlinked(sourceRoot);assertUnlinked(referencesDir);
 const files=identityFiles(identity,p=>fs.readFileSync(checkedAssetPath(sourceRoot,p)));
 const briefPath=join(referencesDir,'brief.md');assertUnlinked(briefPath);
 const brief=fs.existsSync(briefPath)?parseBrief(fs.readFileSync(briefPath,'utf8')):undefined;
 if(brief?.brand&&brief.brand!==identity.subject)throw new Error('identity: existing brief brand disagreement');
 fs.mkdirSync(referencesDir,{recursive:true});assertUnlinked(referencesDir);const lockPath=join(referencesDir,lockName);assertUnlinked(lockPath);const lock=fs.openSync(lockPath,'wx');
 const stage=join(referencesDir,'.offscript-identity-stage-'+randomUUID());
 let retainRecovery=false;
 const changes:Array<{target:string;backup:string;hadOriginal:boolean;installed:boolean}>=[];
 try{
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid,digest:identity.digest,recoveryStage:stage}));const previous=readMarker(referencesDir);
  const affected=new Set([...Object.keys(files),...Object.keys(previous?.managed??{})]);
  if(brief?.sourceDoc&&[...affected].some(name=>resolve(referencesDir,name).toLowerCase()===resolve(referencesDir,brief.sourceDoc!).toLowerCase()))throw new Error('identity: protected source-doc collision');
  for(const name of affected){
   const target=checkedAssetPath(referencesDir,name);if(fs.existsSync(target)&&!Object.hasOwn(previous?.managed??{},name))throw new Error(`identity: unowned file conflict ${name}`);
  }
  const marker:Marker={schemaVersion:1,identity,managed:Object.fromEntries(Object.entries(files).map(([name,content])=>[name,hash(content)]))};
  files[markerName]=Buffer.from(JSON.stringify(marker,null,2)+'\n');
  fs.mkdirSync(stage);
  for(const [name,content] of Object.entries(files)){const staged=checkedAssetPath(stage,'staged/'+name);fs.mkdirSync(dirname(staged),{recursive:true});fs.writeFileSync(staged,content,{flag:'wx'});}
  const names=[...new Set([...Object.keys(previous?.managed??{}),...Object.keys(files)])].filter(n=>n!==markerName).sort().concat(markerName);
  for(const name of names){
   const target=checkedAssetPath(referencesDir,name),backup=checkedAssetPath(stage,'backup/'+name);fs.mkdirSync(dirname(target),{recursive:true});fs.mkdirSync(dirname(backup),{recursive:true});
   const change={target,backup,hadOriginal:fs.existsSync(target),installed:false};changes.push(change);
   if(change.hadOriginal)fs.renameSync(target,backup);
   if(Object.hasOwn(files,name)){fs.renameSync(checkedAssetPath(stage,'staged/'+name),target);change.installed=true;}
  }
 }catch(error){
  const recoveryErrors:unknown[]=[];
  for(const change of changes.reverse()){try{if(change.installed)fs.unlinkSync(change.target);if(change.hadOriginal&&fs.existsSync(change.backup))fs.renameSync(change.backup,change.target);}catch(recoveryError){recoveryErrors.push(recoveryError);}}
  if(recoveryErrors.length){retainRecovery=true;throw new AggregateError([error,...recoveryErrors],`identity: rollback incomplete; lock and recovery retained at ${stage}`);}
  throw error;
 }finally{
  fs.closeSync(lock);
  if(!retainRecovery){const rel=relative(resolve(referencesDir),resolve(stage));if(rel.startsWith('.offscript-identity-stage-')&&!rel.includes(sep)){assertUnlinked(stage);fs.rmSync(stage,{recursive:true,force:true});}fs.unlinkSync(lockPath);}
 }
}
