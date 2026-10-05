import {mkdirSync,writeFileSync,readFileSync,linkSync,unlinkSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {join} from 'node:path';
import {canonicalizeStructural} from '../canonical-digest.js';import {assertIdentitySnapshot,immutableIdentityCopy,safeIdentityId} from './identity.js';import {assertUnlinked} from './fs-safety.js';import type {ApprovedIdentity} from './types.js';
function location(root:string,brandId:string,version:number):string{
 safeIdentityId(brandId);if(!Number.isSafeInteger(version)||version<1)throw new Error('identity: invalid version');const file=join(root,brandId,String(version),'identity.json');assertUnlinked(file);return file;
}
export function loadIdentity(root:string,brandId:string,version:number):ApprovedIdentity{
 const file=location(root,brandId,version);const identity=JSON.parse(readFileSync(file,'utf8')) as ApprovedIdentity;assertIdentitySnapshot(identity);
 if(identity.brandId!==brandId||identity.version!==version)throw new Error('identity: stored version location mismatch');return immutableIdentityCopy(identity);
}
export function saveIdentity(root:string,identity:ApprovedIdentity):void{
 assertIdentitySnapshot(identity);const file=location(root,identity.brandId,identity.version);const dir=join(root,identity.brandId,String(identity.version));mkdirSync(dir,{recursive:true});assertUnlinked(dir);
 const content=JSON.stringify(canonicalizeStructural(identity),null,2)+'\n';const temp=join(dir,'.identity-'+randomUUID()+'.tmp');writeFileSync(temp,content,{encoding:'utf8',flag:'wx'});
 try{try{linkSync(temp,file);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const previous=loadIdentity(root,identity.brandId,identity.version);if(JSON.stringify(canonicalizeStructural(previous))!==JSON.stringify(canonicalizeStructural(identity)))throw new Error('identity: immutable version conflict');}}
 finally{unlinkSync(temp);}
}
