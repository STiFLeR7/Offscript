import type {ProjectContext} from '../project/project-context.js';import type {ApprovedIdentity} from './types.js';
import {projectReferencesDir} from '../paths.js';import {loadProjectContext,recordProjectSession} from '../project/context-store.js';import {readProjectReadiness,writeProjectReadiness} from '../project/readiness-store.js';import {planWorkflow} from '../project/workflow-planner.js';import {refreshIdentityReadiness} from '../project/identity-readiness-adapter.js';import {readInstalledIdentity} from './identity-materializer.js';import {assertIdentitySnapshot,safeIdentityId} from './identity.js';
export function isCurrentTextIdentityApproved(context:ProjectContext|undefined,installed:{digest:string;verified:boolean}|undefined):boolean{
 if(!context||!installed?.verified||! /^[a-f0-9]{64}$/.test(installed.digest))return false;
 const decision=context.decisions.filter(d=>d.subject==='identity').at(-1);const value=decision?.to as Record<string,unknown>|undefined;
 return decision?.kind==='approved'&&!!value&&value.mode==='text'&&value.digest===installed.digest&&Number.isSafeInteger(value.version)&&Number(value.version)>0&&typeof value.actor==='string'&&value.actor.trim().length>0&&!context.decisions.some(d=>d.supersedes===decision.id);
}
/** Caller obtains explicit user approval upstream. This library verifies records/bytes, not human authenticity. */
export function recordIdentityApproval(client:string,identity:ApprovedIdentity,mode:'text'|'marks',now:string):ProjectContext{
 safeIdentityId(client);assertIdentitySnapshot(identity);
 if(mode!=='text'&&mode!=='marks')throw new Error('identity: invalid presentation mode');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(now)||!Number.isFinite(Date.parse(now)))throw new Error('identity: invalid record time');
 const installed=readInstalledIdentity(projectReferencesDir(client));if(installed?.digest!==identity.digest)throw new Error('identity: approval requires exact installed bytes');
 if(mode==='marks'&&!['logo-light','logo-dark'].every(role=>identity.assets.some(a=>a.role===role)))throw new Error('identity: marks approval requires an actual pair');
 const readiness=readProjectReadiness(client);if(!readiness)throw new Error('identity: acquisition readiness required before recording project approval');
 const prior=loadProjectContext(client);const earlier=prior.decisions.filter(d=>d.subject==='identity').at(-1);
 const context=recordProjectSession(client,{goal:'Record explicit identity approval',decisions:[{kind:'approved',subject:'identity',to:{digest:identity.digest,version:identity.version,mode,actor:identity.approval.actor},...(earlier?{supersedes:earlier.id}:{})},...['colors_and_type.css','voice.md','brand-contract.json'].map(subject=>({kind:'asset' as const,subject,to:{identityDigest:identity.digest}})),...identity.assets.map(asset=>({kind:'asset' as const,subject:`identity:${asset.role}:${asset.path}`,to:asset}))]},now);
 const refreshed=refreshIdentityReadiness(client,{...readiness,context});
 const replanned=planWorkflow({projectType:readiness.projectType,deliverables:readiness.deliverables,strategy:readiness.strategy,context});
 const knownIds=new Set(readiness.workflow.tasks.map(t=>t.id));
 const workflow=replanned.tasks.every(t=>knownIds.has(t.id))&&readiness.workflow.tasks.every(t=>replanned.tasks.some(n=>n.id===t.id))?replanned:readiness.workflow;
 writeProjectReadiness(client,{...refreshed,workflow});return context;
}
