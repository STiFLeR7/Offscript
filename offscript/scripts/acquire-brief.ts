/**
 * Brief Acquisition — the Creative Director entry that produces the Canonical Brief.
 *
 *   npx tsx scripts/acquire-brief.ts <client> --answers <answers.json> [--track <t>]
 *
 * Reads the project's manifest, plans the acquisition (which source, which questions), and — when
 * ready — produces the Canonical Brief through the selected source, writing brief.md (+ any source
 * doc) into projects/<client>/references/. Everything past that file is the UNCHANGED pipeline.
 * The generator never learns which source ran.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectReferencesDir, type Track } from '../src/paths.js';
import { readProjectManifest } from '../src/project/workspace.js';
import { createCreativeDirector, type AcquireRequest } from '../src/project/creative-director.js';
import { recordAcquisition } from '../src/project/context-store.js';
import { projectReadinessFor } from '../src/project/readiness-evaluator.js';
import { writeProjectReadiness } from '../src/project/readiness-store.js';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const client = args.find((a) => !a.startsWith('--'));
  if (!client) {
    console.error('usage: npx tsx scripts/acquire-brief.ts <client> [--answers <a.json>] [--track <t>] [--now <iso>]');
    process.exit(2);
  }

  const manifest = readProjectManifest(client); // fail-loud if not initialized
  if (args.includes('--packet') || args.includes('--creative-intent')) {
    throw new Error('External brief adapter inputs are not bundled; use --answers or supply a canonical brief.');
  }
  const answersPath = argValue(args, '--answers');
  const answers = answersPath ? (JSON.parse(readFileSync(resolve(answersPath), 'utf8')) as Record<string, unknown>) : undefined;
  const track = (argValue(args, '--track') as Track | undefined) ?? manifest.deliverables[0];
  const now = argValue(args, '--now');

  const req: AcquireRequest = {
    client,
    projectType: manifest.projectType,
    track,
    answers,
    now,
  };

  const cd = createCreativeDirector();
  const plan = cd.plan(req);
  console.log(`[creative-director] project=${plan.projectType} track=${plan.track} source=${plan.sourceId}`);
  if (!plan.ready) {
    console.log(`[creative-director] missing required info — the interview should collect:`);
    for (const q of plan.questions) console.log(`   - ${q}`);
    console.log(`Provide answers via --answers <json> (keys: one-liner, audience, must-include, brand, tone, goals, success-criteria, body).`);
    process.exit(1);
  }

  const result = await cd.acquire(req);
  const refs = projectReferencesDir(client);
  const briefPath = join(refs, 'brief.md');
  if (existsSync(briefPath)) {
    console.warn(`[acquire] overwriting existing ${briefPath}`);
  }
  writeFileSync(briefPath, result.briefText, 'utf8');
  console.log(`[acquire] wrote ${briefPath} (source: ${result.sourceId})`);
  if (result.sourceDoc) {
    const sp = join(refs, result.sourceDoc.name);
    writeFileSync(sp, result.sourceDoc.text, 'utf8');
    console.log(`[acquire] wrote grounding source-doc ${sp}`);
  }

  // Living Project Context (P52): a completed acquisition enriches the project's long-lived context
  // — confirmed/changed fact decisions, traceable across sessions. Best-effort: never block the
  // primary brief deliverable if context recording fails.
  try {
    const { context } = recordAcquisition({ client, briefText: result.briefText, answers, now: now ?? new Date().toISOString() });
    console.log(`[context] recorded session s${context.version} → projects/${client}/context.json (${context.decisions.length} decisions on record)`);

    // G1-S3 — persist the evaluated ProjectReadiness as a durable artifact so generation can CONSUME it
    // rather than reconstruct it (resolves the G1-S2 blocker). The Acquisition Plan carries strategy +
    // deliverables; the workflow is derived and the just-recorded context threaded in. Own best-effort
    // guard so a readiness-write failure never masks the successful context record.
    try {
      writeProjectReadiness(client, projectReadinessFor(plan, { context }));
      console.log(`[readiness] persisted evaluated readiness → projects/${client}/readiness.json`);
    } catch (err) {
      console.warn(`[readiness] not persisted: ${(err as Error).message}`);
    }
  } catch (err) {
    console.warn(`[context] session not recorded: ${(err as Error).message}`);
  }

  console.log(`  next: generate →  npx tsx scripts/generate.ts ${client} --track ${track}`);
}

main().catch((e) => {
  console.error(`acquire-brief: ${(e as Error).message}`);
  process.exit(1);
});
