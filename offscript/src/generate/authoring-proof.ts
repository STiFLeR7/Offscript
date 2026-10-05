import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,lstatSync,writeFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';
import {versionedStructuralDigest} from '../canonical-digest.js';
import {projectDir,repoRoot} from '../paths.js';
import {readRuntimeProjectReadiness} from '../project/identity-readiness-adapter.js';
import {evaluateReadiness} from '../project/readiness-evaluator.js';
import {proofFiles,type ProofInput} from './proof-inputs.js';
import {buildContext} from './context.js';
import {plan} from './plan.js';
import {authorDocument} from './author.js';
import {createSubagentAuthor,type AuthoringRequest} from './authoring-seam.js';
import {validate} from './validate.js';

function identifier(value:string):void {
  if(typeof value!=='string'||!/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value))throw new Error('proof: unsafe identifier');
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

export function responseKey(request:AuthoringRequest):string {
  identifier(request.item.anchor.id);
  return versionedStructuralDigest(request,'offscript-authoring-proof@1');
}
export function collectProof(requests:AuthoringRequest[],responses:Record<string,string>):{
  state:'waiting'|'complete';missing:string[];fragments:Record<string,string>
} {
  if(!requests.length)throw new Error('proof: empty request set');
  const ids=new Set<string>();const missing:string[]=[];const fragments:Record<string,string>={};
  for(const req of requests){
    const id=req.item.anchor.id;const key=responseKey(req);
    if(ids.has(id))throw new Error('proof: duplicate section identifier');ids.add(id);
    if(!Object.hasOwn(responses,key)){missing.push(key);continue;}
    const html=responses[key];
    if(typeof html!=='string'||!html.trim())throw new Error(`proof: empty response for ${id}`);
    fragments[id]=html;
  }
  return {state:missing.length?'waiting':'complete',missing,fragments};
}

export interface ProofRunOptions {
  project:string;track:'website'|'collateral';run:string;inputs:ProofInput;
  session?:string;evidence?:'session'|'test-double';sectionInstructions?:Record<string,string>;
}
export interface ProofRequest {
  id:string;requestDigest:string;requestPath:string;responsePath:string;responseDigest?:string;
}
export interface ProofRunResult {
  schemaVersion:1;mode:'engine-probe';state:'waiting'|'complete';project:string;track:'website'|'collateral';
  runDir:string;inputDigest:string;identityDigest:string;session:string|null;evidence:'session'|'test-double';
  nativeReadiness:{admitted:boolean;state:string;blockers:string[]};
  requests:ProofRequest[];missing:string[];warnings:string[];outputPath?:string;scorePath?:string;htmlDigest?:string;executionDir?:string;
}
interface Owner {schemaVersion:1;mode:'engine-probe';project:string;track:string;files:Record<string,string>}

/** Owned synthetic workspaces only; never follow a junction or silently replace client files. */
function checkTree(root:string,target:string):void {
  const rel=relative(resolve(root),resolve(target));
  if(rel.startsWith('..')||rel.startsWith(sep)||resolve(target)===resolve(root))throw new Error('proof: path outside owned project');
  let current=resolve(root);
  for(const part of rel.split(sep)){
    if(lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('proof: linked directory');
    current=join(current,part);
  }
  if(lstatSync(current,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('proof: linked path');
}
function rejectLinks(path:string):void {
  const stat=lstatSync(path,{throwIfNoEntry:false});if(!stat)return;if(stat.isSymbolicLink())throw new Error('proof: linked path');
  if(stat.isDirectory())for(const name of readdirSync(path))rejectLinks(join(path,name));
}
function writeJson(path:string,value:unknown):void{writeFileSync(path,JSON.stringify(value,null,2)+'\n','utf8');}

export async function runAuthoringProof(opts:ProofRunOptions):Promise<ProofRunResult> {
  identifier(opts.project);identifier(opts.run);
  const root=projectDir(opts.project);checkTree(join(repoRoot,'projects'),root);rejectLinks(root);
  const ownerPath=join(root,'.engine-probe-owner.json');
  let owner:Owner|undefined;
  if(existsSync(ownerPath)){
    owner=JSON.parse(readFileSync(ownerPath,'utf8')) as Owner;
    if(owner.schemaVersion!==1||owner.mode!=='engine-probe'||owner.project!==opts.project||owner.track!==opts.track||!owner.files)
      throw new Error('proof: project is not owned by this engine probe');
  }else if(existsSync(root)&&readdirSync(root).length){throw new Error('proof: project is not owned by this engine probe');}
  const refs=join(root,'references');
  if(!owner){
    if(opts.track!==opts.inputs.track)throw new Error('proof: input/track disagreement');
    proofFiles(opts.inputs); // Validate new inputs before claiming an empty workspace.
  }
  mkdirSync(root,{recursive:true});
  const lockPath=join(root,'.engine-probe.lock');
  const lock=openSync(lockPath,'wx');
  try {
    writeFileSync(lock,JSON.stringify({pid:process.pid,run:opts.run}));
    const runDir=join(root,'proofs',opts.run);const dispatchDir=join(runDir,'dispatch');
    const rawDir=join(dispatchDir,'.raw');mkdirSync(rawDir,{recursive:true});
    writeJson(join(runDir,'proof.json'),{schemaVersion:1,mode:'engine-probe',state:'waiting',project:opts.project,
      track:opts.track,runDir,session:opts.session?.trim()||null,evidence:opts.evidence??'session',requests:[],missing:[],
      nativeReadiness:{admitted:false,state:'unchecked',blockers:['Current replay has not checked readiness.']},
      warnings:['Current run is checking inputs, responses and validation; no current output published.']});
    if(opts.evidence!==undefined&&opts.evidence!=='session'&&opts.evidence!=='test-double')
      throw new Error('proof: evidence must be session or test-double');
    if(opts.track!==opts.inputs.track)throw new Error('proof: input/track disagreement');
    const files=proofFiles(opts.inputs);
    if(owner)for(const [name,digest] of Object.entries(owner.files)){
      if(!Object.hasOwn(files,name))throw new Error('proof: unknown managed input');
      const file=join(refs,name);
      if(!existsSync(file)||hash(readFileSync(file,'utf8'))!==digest)throw new Error(`proof: managed input changed: ${name}`);
    }
    const readiness=readRuntimeProjectReadiness(opts.project);
    const assessment=readiness?evaluateReadiness(readiness):null;
    const nativeReadiness={admitted:assessment?.admission.admitted??false,state:assessment?.state??'not-recorded',
      blockers:assessment?assessment.blockers.map(b=>b.reason):['No native readiness snapshot supplied.']};
    mkdirSync(refs,{recursive:true});
    for(const [name,content] of Object.entries(files))writeFileSync(join(refs,name),content,'utf8');
    writeJson(ownerPath,{schemaVersion:1,mode:'engine-probe',project:opts.project,track:opts.track,
      files:Object.fromEntries(Object.entries(files).map(([name,content])=>[name,hash(content)]))});
    const context=buildContext(opts.project,opts.track);const authoringPlan=plan(context);
    const instructions=opts.sectionInstructions??{};
    for(const [id,text] of Object.entries(instructions)){
      identifier(id);
      if(!authoringPlan.items.some(item=>item.anchor.id===id))throw new Error(`proof: unknown revision target ${id}`);
      if(typeof text!=='string'||!text.trim())throw new Error('proof: empty revision instruction');
    }
    const {body:ignoredBody,...identityInput}=opts.inputs;
    const identityDigest=versionedStructuralDigest(identityInput,'offscript-proof-identity@1');
    const requests:AuthoringRequest[]=[];const records:ProofRequest[]=[];const responses:Record<string,string>={};
    const seam=createSubagentAuthor({dispatchDir:rawDir,dispatch:async req=>{
      const key=responseKey(req);const id=req.item.anchor.id;
      const requestPath=join(dispatchDir,`${id}.${key}.request.md`);
      const responsePath=join(dispatchDir,`${id}.${key}.response.html`);
      const contractName=`_AUTHOR_CONTRACT.${hash(req.houseContract??'')}.md`;
      if(req.houseContract)writeFileSync(join(dispatchDir,contractName),req.houseContract,'utf8');
      const rendered=readFileSync(join(rawDir,`${id}.request.md`),'utf8').replaceAll('_AUTHOR_CONTRACT.md',contractName);
      writeFileSync(requestPath,`# Engine probe request ${key}\n\n${rendered}\n\nWrite the response to: ${responsePath}\n`,'utf8');
      requests.push(req);const record:ProofRequest={id,requestDigest:key,requestPath,responsePath};records.push(record);
      if(!existsSync(responsePath))return '';
      const html=readFileSync(responsePath,'utf8');
      if(!html.trim())throw new Error(`proof: empty response for ${id}`);
      responses[key]=html;record.responseDigest=hash(html);return html;
    }});
    const assembled=await authorDocument(authoringPlan,context,{author:async original=>{
      const req:AuthoringRequest={...original,
        houseContract:(original.houseContract??'')+`\n\nEngine-probe identity inputs: ${identityDigest}\n`,
        ...(instructions[original.item.anchor.id]?{guidance:original.guidance+'\nScoped revision: '+instructions[original.item.anchor.id]}:{})};
      return seam.author(req);
    }});
    const collected=collectProof(requests,responses);
    const result:ProofRunResult={schemaVersion:1,mode:'engine-probe',state:collected.state,project:opts.project,track:opts.track,
      runDir,inputDigest:versionedStructuralDigest(opts.inputs,'offscript-proof-input@1'),identityDigest,
      session:opts.session?.trim()||null,evidence:opts.evidence??'session',nativeReadiness,requests:records,
      missing:collected.missing,warnings:[...authoringPlan.warnings,...assembled.warnings]};
    if(collected.state==='complete'){
      if(!result.session)throw new Error('proof: complete responses need a declared author session');
      const artifactDigest=versionedStructuralDigest(records.map(r=>({request:r.requestDigest,response:r.responseDigest})),
        'offscript-proof-artifact@1');
      const outDir=join(runDir,'artifacts',artifactDigest);mkdirSync(outDir,{recursive:true});
      const outputPath=join(outDir,'index.html');
      if(existsSync(outputPath)&&readFileSync(outputPath,'utf8')!==assembled.html)throw new Error('proof: existing output changed');
      const executionDir=join(outDir,'executions',randomUUID());mkdirSync(executionDir,{recursive:true});
      const validation=await validate(assembled.html,context,{outDir:executionDir,
        authorMode:result.evidence==='session'?'session':'test-double'},authoringPlan);
      if(!existsSync(outputPath))writeFileSync(outputPath,assembled.html,'utf8');
      Object.assign(result,{outputPath,scorePath:join(executionDir,'score.json'),htmlDigest:hash(assembled.html),executionDir});
      result.warnings.push(`Validation reports ${validation.perRail.reduce((n,r)=>n+r.findings.length,0)} findings; pipeline completion is not creative acceptance.`);
      writeJson(join(executionDir,'proof.json'),result);
    }
    writeJson(join(runDir,'proof.json'),result);return result;
  } finally {closeSync(lock);unlinkSync(lockPath);}
}


