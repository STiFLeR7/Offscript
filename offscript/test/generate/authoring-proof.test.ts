import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectProof, responseKey, runAuthoringProof } from '../../src/generate/authoring-proof.js';
import type { AuthoringRequest } from '../../src/generate/authoring-seam.js';
import type { ProofInput } from '../../src/generate/proof-inputs.js';
import * as validationModule from '../../src/generate/validate.js';
import { projectDir, repoRoot } from '../../src/paths.js';

const req:AuthoringRequest={item:{anchor:{id:'hero',anchor:'hero'},archetype:'hero',tokenRoles:[],intent:'Explain'},
  oneLiner:'Northline notes',tone:'quiet',guidance:'Preserve facts',houseContract:'Quiet type'};
const input:ProofInput={brand:'Northline',oneLiner:'Organize field notes',audience:'Researchers',tone:'quiet',
  body:'## Hero\nOrganize field notes.\n\n## Features\nCapture and group notes.\n\n## Metrics\nCapture, organize, review.\n\n## CTA\nExplore the example.\n\n## Footer\nFictional demonstration.',
  accent:'#506342',fontFamily:'Georgia',track:'website'};
const owned:string[]=[];
function project(){const name='proof-test-'+randomUUID();owned.push(projectDir(name));return name;}
afterEach(()=>{
  for(const path of owned.splice(0)){
    const rel=relative(join(repoRoot,'projects'),path);
    if(!rel||rel.startsWith('..'))throw new Error('Unsafe fixture cleanup');
    rmSync(path,{recursive:true,force:true});
  }
});

function completeResponses(result:Awaited<ReturnType<typeof runAuthoringProof>>){
  for(const item of result.requests)writeFileSync(item.responsePath,
    `<section id="${item.id}"><h2>${item.id}</h2><p>Synthetic deterministic test response.</p></section>`);
}

describe('request-bound proof collection',()=>{
  it('waits for absent responses without manufacturing fragments',()=>{
    const result=collectProof([req],{});
    expect(result.state).toBe('waiting');expect(result.missing).toHaveLength(1);
    expect(result.fragments).toEqual({});
  });
  it('rejects stale instructions and changed identity',()=>{
    for(const changed of [{...req,tone:'energetic'},{...req,houseContract:'Different identity'}]){
      expect(responseKey(changed)).not.toBe(responseKey(req));
      expect(collectProof([changed],{[responseKey(req)]:'<section id="hero">Old</section>'}).state).toBe('waiting');
    }
  });
  it('accepts only the bound nonempty response',()=>{
    const result=collectProof([req],{[responseKey(req)]:'<section id="hero">Actual content</section>'});
    expect(result.state).toBe('complete');expect(result.fragments.hero).toContain('Actual content');
    expect(()=>collectProof([req],{[responseKey(req)]:'   '})).toThrow(/empty/i);
  });
  it('rejects empty or duplicated request sets',()=>{
    expect(()=>collectProof([],{})).toThrow();expect(()=>collectProof([req,req],{})).toThrow();
  });
});

describe('actual engine-probe wiring',()=>{
  it('writes every prompt, resumes bound responses and isolates a targeted revision',async()=>{
    const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input,
      session:'vitest deterministic double',evidence:'test-double' as const};
    const waiting=await runAuthoringProof(options);
    expect(waiting.state).toBe('waiting');expect(waiting.requests.length).toBeGreaterThanOrEqual(5);
    expect(waiting.outputPath).toBeUndefined();expect(waiting.nativeReadiness.admitted).toBe(false);
    expect(existsSync(join(waiting.runDir,'index.html'))).toBe(false);
    expect(existsSync(join(waiting.runDir,'score.json'))).toBe(false);
    for(const item of waiting.requests){expect(existsSync(item.requestPath)).toBe(true);
      expect(readFileSync(item.requestPath,'utf8')).toContain(item.requestDigest);}
    completeResponses(waiting);
    const completed=await runAuthoringProof(options);
    expect(completed.state).toBe('complete');expect(completed.mode).toBe('engine-probe');
    expect(readFileSync(completed.outputPath!,'utf8')).toContain('Synthetic deterministic test response.');
    expect(existsSync(completed.scorePath!)).toBe(true);
    expect(existsSync(join(projectDir(name),'readiness.json'))).toBe(false);
    const repeat=await runAuthoringProof(options);
    expect(repeat.outputPath).toBe(completed.outputPath);
    const revised=await runAuthoringProof({...options,sectionInstructions:{hero:'Shorten the headline.'}});
    expect(revised.state).toBe('waiting');expect(revised.missing).toHaveLength(1);
    expect(revised.outputPath).toBeUndefined();
    const originalKeys=Object.fromEntries(waiting.requests.map(r=>[r.id,r.requestDigest]));
    for(const r of revised.requests)expect(r.requestDigest===originalKeys[r.id]).toBe(r.id!=='hero');
    expect(existsSync(completed.outputPath!)).toBe(true);
  },60000);
  it('invalidates all responses when the identity changes',async()=>{
    const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input};
    const first=await runAuthoringProof(options);completeResponses(first);
    const changed=await runAuthoringProof({...options,inputs:{...input,accent:'#a840ed'}});
    expect(changed.state).toBe('waiting');expect(changed.missing).toHaveLength(first.requests.length);
  });
  it('rejects an empty saved response and an unknown revision target',async()=>{
    const options={project:project(),track:'website' as const,run:'r1',inputs:input};
    const first=await runAuthoringProof(options);writeFileSync(first.requests[0].responsePath,' ');
    await expect(runAuthoringProof(options)).rejects.toThrow(/empty/i);
    await expect(runAuthoringProof({...options,sectionInstructions:{absent:'Change'}})).rejects.toThrow(/unknown/i);
  });
  it('preserves foreign project files and rejects unsafe identifiers before writes',async()=>{
    const name=project();const refs=join(projectDir(name),'references');mkdirSync(refs,{recursive:true});
    writeFileSync(join(refs,'brief.md'),'Private original brief');
    await expect(runAuthoringProof({project:name,track:'website',run:'r1',inputs:input})).rejects.toThrow(/owned/i);
    expect(readFileSync(join(refs,'brief.md'),'utf8')).toBe('Private original brief');
    await expect(runAuthoringProof({project:'../outside',track:'website',run:'r1',inputs:input})).rejects.toThrow(/identifier/i);
  });
  it('refuses to overwrite manually edited proof inputs',async()=>{
    const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input};
    await runAuthoringProof(options);const voice=join(projectDir(name),'references','voice.md');
    writeFileSync(voice,'User correction');await expect(runAuthoringProof(options)).rejects.toThrow(/changed/i);
    expect(readFileSync(voice,'utf8')).toBe('User correction');
  });
});


it('rejects dangling junctions before claiming a workspace',async()=>{
  const name=project();const root=projectDir(name);
  const options={project:name,track:'website' as const,run:'r1',inputs:input};
  await runAuthoringProof(options);
  const target=join(root,'never-created');symlinkSync(target,join(root,'references','dangling-assets'),'junction');
  await expect(runAuthoringProof(options)).rejects.toThrow(/linked/i);
  expect(existsSync(target)).toBe(false);
});

it('CLI waits with exit 3, completes with declared session and rejects unsafe ids',()=>{
  const name=project();
  const cli=join(repoRoot,'scripts','authoring-proof.ts');
  const args=[join(repoRoot,'node_modules','tsx','dist','cli.mjs'),cli,'--project',name,'--track','website',
    '--run','cli-proof','--inputs',resolve(repoRoot,'..','examples','authoring-proof','northline.json')];
  const waiting=spawnSync(process.execPath,args,{cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(waiting.status,waiting.stderr).toBe(3);
  const proofPath=join(projectDir(name),'proofs','cli-proof','proof.json');
  const first=JSON.parse(readFileSync(proofPath,'utf8'));
  expect(first.state).toBe('waiting');completeResponses(first);
  const withoutSession=spawnSync(process.execPath,args,{cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(withoutSession.status).toBe(1);expect(withoutSession.stderr).toContain('session');
  const completed=spawnSync(process.execPath,[...args,'--session','CLI deterministic test double','--evidence','test-double'],
    {cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(completed.status,completed.stderr).toBe(0);
  const cliProof=JSON.parse(readFileSync(proofPath,'utf8'));
  expect(cliProof.state).toBe('complete');expect(cliProof.evidence).toBe('test-double');
  expect(JSON.parse(readFileSync(cliProof.scorePath,'utf8')).authorMode).toBe('test-double');
  const invalidEvidence=spawnSync(process.execPath,[...args,'--evidence','fabricated'],{cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(invalidEvidence.status).toBe(1);expect(invalidEvidence.stderr).toContain('evidence');
  const incompleteReplay=spawnSync(process.execPath,args,{cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(incompleteReplay.status).toBe(1);
  const pending=JSON.parse(readFileSync(proofPath,'utf8'));
  expect(pending.state).toBe('waiting');expect(pending.outputPath).toBeUndefined();
  const badArgs=[...args];badArgs[3]='../outside';
  const rejected=spawnSync(process.execPath,badArgs,{cwd:resolve(repoRoot,'..'),encoding:'utf8'});
  expect(rejected.status).toBe(1);expect(rejected.stderr).toContain('identifier');
},60000);



it('clears completion before managed-input or readiness replay failures while preserving history',async()=>{
  for(const failure of ['managed-input','readiness']){
    const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input,
      session:'regression double',evidence:'test-double' as const};
    const waiting=await runAuthoringProof(options);completeResponses(waiting);
    const completed=await runAuthoringProof(options);
    if(failure==='managed-input')writeFileSync(join(projectDir(name),'references','voice.md'),'Manual correction');
    else writeFileSync(join(projectDir(name),'readiness.json'),'{broken');
    await expect(runAuthoringProof(options)).rejects.toThrow();
    const current=JSON.parse(readFileSync(join(completed.runDir,'proof.json'),'utf8'));
    expect(current.state).toBe('waiting');expect(current.outputPath).toBeUndefined();
    expect(existsSync(completed.outputPath!)).toBe(true);
  }
},60000);

it('does not clear another active execution when lock acquisition fails',async()=>{
  const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input,
    session:'regression double',evidence:'test-double' as const};
  const waiting=await runAuthoringProof(options);completeResponses(waiting);
  const completed=await runAuthoringProof(options);const record=join(completed.runDir,'proof.json');
  const before=readFileSync(record,'utf8');writeFileSync(join(projectDir(name),'.engine-probe.lock'),'Active execution');
  await expect(runAuthoringProof(options)).rejects.toThrow();
  expect(readFileSync(record,'utf8')).toBe(before);
});

it('preserves execution evidence across changed session/render settings and failed validation',async()=>{
  const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input,
    session:'first deterministic double',evidence:'test-double' as const};
  const waiting=await runAuthoringProof(options);completeResponses(waiting);
  const first=await runAuthoringProof(options);const firstScore=readFileSync(first.scorePath!,'utf8');
  const firstRecord=join(first.scorePath!,'..','proof.json');const firstProof=readFileSync(firstRecord,'utf8');
  const flag=process.env.OFFSCRIPT_PLAYWRIGHT;
  try {
    process.env.OFFSCRIPT_PLAYWRIGHT='0';
    const second=await runAuthoringProof({...options,session:'second deterministic double'});
    expect(second.outputPath).toBe(first.outputPath);expect(second.scorePath).not.toBe(first.scorePath);
    expect(readFileSync(first.scorePath!,'utf8')).toBe(firstScore);
    expect(readFileSync(firstRecord,'utf8')).toBe(firstProof);
    expect(JSON.parse(readFileSync(join(second.scorePath!,'..','proof.json'),'utf8')).session).toBe('second deterministic double');
    const secondScore=readFileSync(second.scorePath!,'utf8');
    const spy=vi.spyOn(validationModule,'validate').mockImplementationOnce(async (_html,_context,opts)=>{
      writeFileSync(join(opts.outDir,'score.json'),'Incomplete failed validation');throw new Error('Validation failed');
    });
    try {await expect(runAuthoringProof({...options,session:'failed attempt'})).rejects.toThrow('Validation failed');}
    finally {spy.mockRestore();}
    expect(readFileSync(first.scorePath!,'utf8')).toBe(firstScore);
    expect(readFileSync(firstRecord,'utf8')).toBe(firstProof);
    expect(readFileSync(second.scorePath!,'utf8')).toBe(secondScore);
    expect(JSON.parse(readFileSync(join(first.runDir,'proof.json'),'utf8')).state).toBe('waiting');
  } finally {if(flag===undefined)delete process.env.OFFSCRIPT_PLAYWRIGHT;else process.env.OFFSCRIPT_PLAYWRIGHT=flag;}
},60000);


it('can retry a new project after invalid inputs without leaving an unowned workspace',async()=>{
  const name=project();const options={project:name,track:'website' as const,run:'r1',inputs:input};
  await expect(runAuthoringProof({...options,inputs:{...input,accent:'invalid'}})).rejects.toThrow();
  expect(existsSync(projectDir(name))).toBe(false);
  expect((await runAuthoringProof(options)).state).toBe('waiting');
});
