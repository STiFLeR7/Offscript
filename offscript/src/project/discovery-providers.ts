/**
 * P50 — The shipped Context Discovery providers.
 *
 * Each maps one real workspace artifact to attributable evidence. They are the grounded members of
 * the 10-source discovery order; the remaining sources (uploaded assets, previous Offscript artifacts,
 * seam adapters, …) are added the SAME way — a provider + `registerDiscoveryProvider` — with no
 * orchestration change (see P50 report §6/§7).
 *
 *   existing-brief      — a prior Canonical Brief (strongest: HIGH, drives "complete context")
 *   brand-kit           — references/brand-kit.json (authored brand facts, drives "partial context")
 *   workspace-manifest  — project.json (a client slug is only a LOW-confidence brand hint)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectReferencesDir } from '../paths.js';
import { parseBrief } from '../generate/brief.js';
import { projectManifestPath } from './workspace.js';
import { loadProjectContext, projectContextPath } from './context-store.js';
import { CONFIDENCE, hasValue, type Evidence } from './evidence.js';
import type { DiscoveryProvider, DiscoveryContext } from './discovery.js';

/** brand-kit facts are authored, not slugs — trust them enough to suppress the interview (> 0.7). */
const BRAND_KIT_CONFIDENCE = 0.8;

function makeEvidence(
  field: string,
  value: unknown,
  source: string,
  confidence: number,
  ctx: DiscoveryContext,
  origin: string,
  supportingArtifact: string,
): Evidence {
  return { field, value, source, confidence, timestamp: ctx.now, origin, supportingArtifact };
}

/** Source 4 — an existing Canonical Brief. Every present field becomes HIGH-confidence evidence. */
export function existingBriefProvider(): DiscoveryProvider {
  return {
    id: 'existing-brief',
    label: 'Existing Canonical Brief',
    discover(ctx) {
      const path = join(projectReferencesDir(ctx.client), 'brief.md');
      if (!existsSync(path)) return [];
      let brief;
      try {
        brief = parseBrief(readFileSync(path, 'utf8'));
      } catch {
        return []; // a malformed brief is not evidence
      }
      const out: Evidence[] = [];
      const push = (field: string, value: unknown) => {
        if (hasValue(value)) out.push(makeEvidence(field, value, 'existing-brief', CONFIDENCE.HIGH, ctx, path, 'brief.md'));
      };
      push('one-liner', brief.oneLiner);
      push('audience', brief.audience);
      push('brand', brief.brand);
      push('tone', brief.tone);
      push('goals', brief.goals);
      push('must-include', brief.mustInclude);
      push('success-criteria', brief.successCriteria);
      return out;
    },
  };
}

/** Source 5 — a Brand Kit at references/brand-kit.json (brand / tone / audience / … facts). */
export function brandKitProvider(): DiscoveryProvider {
  return {
    id: 'brand-kit',
    label: 'Brand Kit',
    discover(ctx) {
      const path = join(projectReferencesDir(ctx.client), 'brand-kit.json');
      if (!existsSync(path)) return [];
      let kit: Record<string, unknown>;
      try {
        kit = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      } catch {
        return [];
      }
      const out: Evidence[] = [];
      const push = (field: string, value: unknown) => {
        if (hasValue(value)) out.push(makeEvidence(field, value, 'brand-kit', BRAND_KIT_CONFIDENCE, ctx, path, 'brand-kit.json'));
      };
      const at = (...keys: string[]) => keys.map((k) => kit[k]).find((v) => v != null);
      push('brand', at('brand'));
      push('tone', at('tone'));
      push('audience', at('audience'));
      push('one-liner', at('oneLiner', 'one-liner'));
      push('goals', at('goals'));
      push('must-include', at('mustInclude', 'must-include'));
      push('success-criteria', at('successCriteria', 'success-criteria'));
      return out;
    },
  };
}

/** Sources 1/2/9 — Project metadata / Workspace / configuration. The client slug is a WEAK brand
 *  hint only (a slug, not a display name), so it never on its own suppresses the interview. */
export function workspaceManifestProvider(): DiscoveryProvider {
  return {
    id: 'workspace-manifest',
    label: 'Workspace metadata',
    discover(ctx) {
      const path = projectManifestPath(ctx.client);
      if (!existsSync(path)) return [];
      return [makeEvidence('brand', titleize(ctx.client), 'workspace-manifest', CONFIDENCE.LOW, ctx, path, 'project.json')];
    },
  };
}

/**
 * Source 8 — previous Offscript artifacts / prior sessions. Surfaces the Living Project Context's
 * confirmed facts as evidence, so a NEW session builds on prior decisions (the "future sessions
 * reuse prior context" bridge, P52). Read-only — it never mutates the context. Not in the default
 * set (keeps discovery byte-stable); opt in via `createCreativeDirector({ providers: [...] })`.
 */
export function projectContextProvider(): DiscoveryProvider {
  return {
    id: 'project-context',
    label: 'Living project context',
    discover(ctx) {
      let context;
      try {
        context = loadProjectContext(ctx.client);
      } catch {
        return []; // no project / no context yet
      }
      const path = projectContextPath(ctx.client);
      const out: Evidence[] = [];
      for (const [field, cf] of Object.entries(context.confirmedFacts)) {
        if (hasValue(cf.value)) out.push(makeEvidence(field, cf.value, 'project-context', CONFIDENCE.HIGH, ctx, path, 'context.json'));
      }
      return out;
    },
  };
}

/** slug → Title Case (e.g. "acme-co" → "Acme Co"). */
function titleize(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The default shipped provider set, in discovery order (strongest source first). */
export function defaultDiscoveryProviders(): DiscoveryProvider[] {
  return [existingBriefProvider(), brandKitProvider(), workspaceManifestProvider()];
}
