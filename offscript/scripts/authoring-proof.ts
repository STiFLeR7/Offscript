import {parseArgs} from 'node:util';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runAuthoringProof} from '../src/generate/authoring-proof.js';
import type {ProofInput} from '../src/generate/proof-inputs.js';

try {
  const {values}=parseArgs({options:{project:{type:'string'},track:{type:'string'},run:{type:'string'},
    inputs:{type:'string'},session:{type:'string'},instructions:{type:'string'},evidence:{type:'string'}},strict:true,allowPositionals:false});
  if(!values.project||!values.run||!values.inputs||(values.track!=='website'&&values.track!=='collateral'))
    throw new Error('Usage: --project ID --track website|collateral --run ID --inputs proof.json [--session LABEL] [--instructions revisions.json] [--evidence session|test-double]');
  if(values.evidence!==undefined&&values.evidence!=='session'&&values.evidence!=='test-double')
    throw new Error('evidence must be session or test-double');
  const inputs=JSON.parse(readFileSync(resolve(values.inputs),'utf8').replace(/^\uFEFF/,'')) as ProofInput;
  const sectionInstructions=values.instructions?JSON.parse(readFileSync(resolve(values.instructions),'utf8').replace(/^\uFEFF/,'')) as Record<string,string>:undefined;
  const result=await runAuthoringProof({project:values.project,track:values.track,run:values.run,inputs,
    session:values.session,evidence:values.evidence as 'session'|'test-double'|undefined,sectionInstructions});
  console.log(JSON.stringify({mode:result.mode,state:result.state,requests:result.requests.length,missing:result.missing.length,
    nativeReadiness:result.nativeReadiness,evidence:result.runDir+'/proof.json',output:result.outputPath,warnings:result.warnings},null,2));
  process.exitCode=result.state==='waiting'?3:0;
} catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
