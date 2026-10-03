/**
 * `offscript audit-briefs` — Canonical Brief Audit (G5-S1). READ-ONLY.
 *
 *   npx tsx scripts/audit-briefs.ts
 *
 * Audits every project's `references/brief.md` for the non-supplyable canonical evidence facts a brief
 * must carry to be migratable (`brand`, `audience`, `tone`). Reports each defect + its minimal textual
 * repair. It reads only — it NEVER rewrites a brief, evaluates readiness, or writes anything.
 *
 * This is the audit that turns G4-S1's "4 projects are permanently NOT_MIGRATABLE (optional:tone)" into a
 * per-project, deterministic repair list. The operator applies the repairs by hand; this tool only reports.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, projectReferencesDir } from '../src/paths.js';
import { selectProjects } from '../src/project/fleet-assessment.js';
import { auditCanonicalBrief } from '../src/project/brief-canonical-audit.js';

function main(): void {
  const root = join(repoRoot, 'projects');
  const candidates = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name, hasReferences: existsSync(join(root, e.name, 'references')) }))
    : [];
  const clients = selectProjects(candidates);

  const rows = clients.map((client) => {
    const briefPath = join(projectReferencesDir(client), 'brief.md');
    const briefText = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : undefined;
    return { client, briefText, audit: briefText !== undefined ? auditCanonicalBrief(briefText) : undefined };
  });

  const defective = rows.filter((r) => r.audit && !r.audit.canonical);
  const clean = rows.filter((r) => r.audit && r.audit.canonical);
  const noBrief = rows.filter((r) => r.audit === undefined);

  console.log(`\n[audit-briefs] ${clients.length} project(s) under ${root}`);
  console.log(`  canonical: ${clean.length}   defective: ${defective.length}   no brief: ${noBrief.length}`);

  if (defective.length > 0) {
    console.log(`\n  Defective briefs (canonical evidence gaps that keep the project NOT_MIGRATABLE):`);
    for (const r of defective) {
      const ids = r.audit!.defects.map((d) => `${d.blockerId} [${d.severity}]`).join(', ');
      console.log(`   - ${r.client.padEnd(22)} ${ids}`);
      for (const d of r.audit!.defects) console.log(`         repair: ${d.repair}`);
    }
  }
  console.log(`\n  Canonical (migratable — no brief repair needed): ${clean.map((r) => r.client).join(', ') || '(none)'}`);
  if (noBrief.length > 0) console.log(`  No brief.md: ${noBrief.map((r) => r.client).join(', ')}`);
  console.log(`\n  (read-only — no brief was modified)`);
}

main();
