import {existsSync} from 'node:fs';import {projectReferencesDir} from '../paths.js';import type {ProjectReadiness} from './readiness.js';import {readProjectReadiness} from './readiness-store.js';import {loadProjectContext,projectContextPath} from './context-store.js';import {readInstalledIdentity} from '../identity/identity-materializer.js';import {assertUnlinked} from '../identity/fs-safety.js';import {safeIdentityId} from '../identity/identity.js';
/** Runtime owns byte verification: never reuse a serialized or caller-supplied verified flag. */
export function refreshIdentityReadiness(client:string,readiness:ProjectReadiness):ProjectReadiness{
 safeIdentityId(client);const identity=readInstalledIdentity(projectReferencesDir(client));const path=projectContextPath(client);assertUnlinked(path);
 let context=identity||existsSync(path)?loadProjectContext(client):readiness.context;
 if(identity&&context){
  const currentAssets=new Set(identity.assets.map(a=>`identity:${a.role}:${a.path}`));
  context={...context,knownAssets:context.knownAssets.filter(name=>!name.startsWith('identity:logo-')||currentAssets.has(name))};
  const latest=context.decisions.filter(d=>d.subject==='identity').at(-1);const value=latest?.to as Record<string,unknown>|undefined;
  if(latest?.kind==='approved'&&value?.digest===identity.digest&&value?.mode==='marks'&&!['logo-light','logo-dark'].every(role=>identity.assets.some(a=>a.role===role)))throw new Error('identity: approved mark assets are missing');
 }
 const {installedIdentity:discarded,...rest}=readiness;
 return {...rest,...(context?{context}:{}),...(identity?{installedIdentity:{digest:identity.digest,verified:true}}:{})};
}
export function readRuntimeProjectReadiness(client:string):ProjectReadiness|null{
 safeIdentityId(client);const readiness=readProjectReadiness(client);return readiness?refreshIdentityReadiness(client,readiness):null;
}
