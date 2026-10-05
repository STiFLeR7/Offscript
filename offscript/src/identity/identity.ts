import {createHash} from 'node:crypto';
import {versionedStructuralDigest} from '../canonical-digest.js';
import {parseBrandContract} from '../brand-contract.js';
import {isSafeAssetPath} from './direction.js';
import type {Approval,ApprovedIdentity,IdentityDraft} from './types.js';
const nonempty=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
export function safeIdentityId(value:unknown):asserts value is string {
 if(!nonempty(value)||!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value))throw new Error('identity: unsafe identifier');
}
const required=['schemaVersion','brandId','version','directionId','subject','css','voice','assets'];
export function assertIdentityDraft(draft:IdentityDraft):void{
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).some(k=>![...required,'brandContractJson','imageryManifest'].includes(k)))throw new Error('identity: invalid draft fields');
 if(draft.schemaVersion!==1||!Number.isSafeInteger(draft.version)||draft.version<1)throw new Error('identity: invalid schema/version');
 safeIdentityId(draft.brandId);safeIdentityId(draft.directionId);
 for(const key of ['subject','css','voice'] as const)if(!nonempty(draft[key]))throw new Error(`identity: missing ${key}`);
 if(!Array.isArray(draft.assets))throw new Error('identity: missing assets');const paths=new Set<string>();const logos=new Set<string>();
 for(const asset of draft.assets){
  if(!asset||typeof asset!=='object'||Object.keys(asset).some(k=>!['path','digest','role'].includes(k))||!isSafeAssetPath(asset.path)||! /^[a-f0-9]{64}$/.test(asset.digest)||!['logo-light','logo-dark','font','image'].includes(asset.role))throw new Error('identity: invalid asset');
  const key=asset.path.toLowerCase();if(paths.has(key))throw new Error('identity: duplicate asset path');paths.add(key);
  if(asset.role.startsWith('logo-')){if(logos.has(asset.role))throw new Error('identity: duplicate logo role');logos.add(asset.role);}
 }
 if(draft.brandContractJson!==undefined){if(!nonempty(draft.brandContractJson))throw new Error('identity: empty contract');const contract=parseBrandContract(draft.brandContractJson);if(contract.subject!==draft.subject)throw new Error('identity: contract subject disagreement');}
 if(draft.imageryManifest!==undefined&&(!isSafeAssetPath(draft.imageryManifest)||!draft.assets.some(a=>a.path===draft.imageryManifest)))throw new Error('identity: imagery manifest must be a checked asset');
}
function assertApproval(approval:Approval):void{
 if(!approval||typeof approval!=='object'||Object.keys(approval).some(k=>!['actor','at','source'].includes(k))||approval.source!=='user'||!nonempty(approval.actor)||typeof approval.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(approval.at)||!Number.isFinite(Date.parse(approval.at))||new Date(approval.at).toISOString().slice(0,19)!==approval.at.slice(0,19))throw new Error('identity: invalid user approval');
}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function assertIdentitySnapshot(identity:ApprovedIdentity):void{
 if(!identity||typeof identity!=='object')throw new Error('identity: invalid snapshot');
 const {approval,digest,...draft}=identity;assertIdentityDraft(draft);assertApproval(approval);
 if(digest!==versionedStructuralDigest({draft,approval},'offscript-identity@1'))throw new Error('identity: snapshot digest mismatch');
}
export function approveIdentity(draft:IdentityDraft,approval:Approval,readAsset:(path:string)=>Uint8Array):ApprovedIdentity{
 assertIdentityDraft(draft);assertApproval(approval);
 for(const asset of draft.assets)if(createHash('sha256').update(readAsset(asset.path)).digest('hex')!==asset.digest)throw new Error(`identity: asset bytes mismatch ${asset.path}`);
 const copy=JSON.parse(JSON.stringify({draft,approval})) as {draft:IdentityDraft;approval:Approval};
 return freeze({...copy.draft,approval:copy.approval,digest:versionedStructuralDigest(copy,'offscript-identity@1')});
}
export function verifyIdentity(identity:ApprovedIdentity,readAsset:(path:string)=>Uint8Array):boolean{
 try{assertIdentitySnapshot(identity);return identity.assets.every(asset=>createHash('sha256').update(readAsset(asset.path)).digest('hex')===asset.digest);}catch{return false;}
}
export function immutableIdentityCopy(identity:ApprovedIdentity):ApprovedIdentity{assertIdentitySnapshot(identity);return freeze(JSON.parse(JSON.stringify(identity)) as ApprovedIdentity);}
