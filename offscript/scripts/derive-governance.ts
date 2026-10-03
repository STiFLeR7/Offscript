/**
 * W15 corpus prep — materialize the in-session Governed Producer's output as persisted governance packs.
 *
 * This is NOT engine code. It stands in for the in-session subagent deriver: it carries genuine,
 * brief-grounded governance content (authored by reasoning over each W14 brief + the constitutions) and
 * writes the complete `governance-drafts.json` (all seven kinds, every authored category, null where not
 * authored) into each client's references dir. The headless generator then replays it deterministically.
 *
 * Page-scoped models (information / communication / spatial / visual / experienceCharacter) need no
 * section ids. The id-referencing models (progression encounterSequence, mechanism requiredMechanisms)
 * are filled ONLY for example-brand, where the exact plan ids are read from its sections.md so the
 * permutation + full-coverage guards are satisfied — demonstrating governed reordering + role.
 *
 * Usage: tsx scripts/derive-governance.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type ModelKind } from '../src/knowledge/derivation/models.js';

const ROOT = join(import.meta.dirname, '..', 'projects');

/** Compact per-client authored content: { kind: { category: content } }. Expanded to full drafts below. */
type Authored = Partial<Record<ModelKind, Record<string, unknown>>>;

function expand(authored: Authored): ModelDraft[] {
  return MODEL_KINDS.map((kind) => ({
    kind,
    categories: Object.fromEntries(MODEL_SCHEMA[kind].categories.map((c) => [c.key, authored[kind]?.[c.key] ?? null])),
    rationale: `w15 governed-producer output (${kind})`,
  }));
}

/** Read the planner's section ids for a client (deterministic; same pre-reorder ids the orchestrator sees). */
function planIds(client: string): string[] {
  const p = join(ROOT, client, 'website', 'sections.md');
  if (!existsSync(p)) throw new Error(`derive-governance: ${p} not found — generate the client (disabled) first to capture plan ids.`);
  return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim().startsWith('- id:')).map((l) => l.split('- id:')[1].trim());
}

// ── page-scoped governance, authored per brief (genuine, domain-grounded) ────────────
const PAGE: Record<string, Authored> = {
  example-brand: {
    information: { informationPriorities: ['the hidden cost of manual glue work is the lead argument', 'four-system integration burden second'], completenessModel: 'every must-include maps to a section; outcomes proof present', informationRelationships: ['the problem frames the mechanism; metrics validate the claim'] },
    communication: { perceptualEntry: ['open on the manual-work tax the reader already feels'], beliefFormation: ['name the pain → show the digital worker → prove the quarter-one outcome'], communicationEnergy: ['calm operational authority, never hype'] },
    spatial: { spatialAllocation: ['hero carries the claim full-bleed; proof in a measured band'], density: ['airy, generous whitespace around the numbers'], spatialHierarchy: ['hero dominant, then the mechanism, then proof'] },
    visual: { perceivedImportanceAndStanding: ['the outcome metrics are the loudest non-hero element'], perceivedAffordance: ['the demo CTA reads unmistakably actionable'] },
    experienceCharacter: { experienceCharacter: ['calm, precise, credible to an operations leader'], creativePrinciples: ['restraint over decoration; let the numbers speak'], behaviouralIdentity: ['responsive and quiet, never flashy'] },
  },
  halyard: {
    information: { informationPriorities: ['hidden cloud waste is the lead; savings proof second'], completenessModel: 'covers waste, mechanism, three-step connect, proof, comparison, integrations, faq, cta', informationRelationships: ['the optimization engine is evidenced by the measured-savings band'] },
    communication: { perceptualEntry: ['lead with the waste hiding in a modern multi-cloud bill'], beliefFormation: ['name the waste → show continuous optimization → prove conservative savings'], communicationEnergy: ['confident, engineering-credible, non-salesy'] },
    spatial: { spatialAllocation: ['hero full-bleed; the three-step process as a horizontal band'], density: ['structured, scannable for a platform engineer'], spatialHierarchy: ['hero, then the engine, then the savings numbers'] },
    visual: { perceivedImportanceAndStanding: ['the savings metrics dominate the proof band'], perceivedAffordance: ['the free-assessment CTA is obviously clickable'] },
    experienceCharacter: { experienceCharacter: ['precise, trustworthy, deploy-safe'], creativePrinciples: ['show, do not claim; conservative numbers only'], behaviouralIdentity: ['fast and unobtrusive — never slows the reader, like the product'] },
  },
  veyra: {
    information: { informationPriorities: ['the after-hours charting burden is the lead; accuracy + safety second'], completenessModel: 'problem, mechanism, evidence, EHR write-back, compliance, testimonials, faq, cta all present', informationRelationships: ['the evidence band substantiates the ambient-capture mechanism; compliance de-risks it'] },
    communication: { perceptualEntry: ['open on the clinician finishing notes after hours'], beliefFormation: ['make the burden visceral → show ambient-to-coded-note → earn trust with accuracy + compliance'], communicationEnergy: ['calm clinical authority; reassuring, evidence-led'] },
    spatial: { spatialAllocation: ['hero states the before-the-patient-leaves promise; evidence in a measured band'], density: ['clinical-clean, generous whitespace'], spatialHierarchy: ['hero, then the mechanism, then the evidence + compliance'] },
    visual: { perceivedImportanceAndStanding: ['accuracy figures and the compliance marks carry visual weight'], perceivedAffordance: ['the pilot CTA reads as a considered next step, not a hard sell'] },
    experienceCharacter: { experienceCharacter: ['calm, rigorous, safety-first'], creativePrinciples: ['evidence over adjectives; human-in-the-loop visible'], behaviouralIdentity: ['quiet and dependable; trust is the brand'] },
  },
  forgeline: {
    information: { informationPriorities: ['flying blind on mixed/aging equipment is the lead; no-rip-and-replace second'], completenessModel: 'problem, connect-normalize-act, throughput/downtime/yield, OEE proof, case study, integrations, cta', informationRelationships: ['the OEE metrics validate the connect-normalize-act mechanism; the case study makes it concrete'] },
    communication: { perceptualEntry: ['open on the plant manager who cannot see the floor'], beliefFormation: ['make flying-blind concrete → show connect on the EXISTING floor → prove OEE on real lines'], communicationEnergy: ['pragmatic, plant-floor credible, capital-aware'] },
    spatial: { spatialAllocation: ['hero shows the whole floor made visible; metrics in a dense ops band'], density: ['information-dense, built for an operations reader'], spatialHierarchy: ['hero, then the three-step mechanism, then OEE proof'] },
    visual: { perceivedImportanceAndStanding: ['the OEE gain figures are the loudest proof element'], perceivedAffordance: ['the single-line proof-of-value CTA reads low-commitment'] },
    experienceCharacter: { experienceCharacter: ['pragmatic, robust, no-nonsense'], creativePrinciples: ['proof on real lines, never a slideware promise'], behaviouralIdentity: ['solid and dependable, like good factory equipment'] },
  },
  ledgerwise: {
    information: { informationPriorities: ['the build-it-yourself trap is the lead; one-API + kept-margin second'], completenessModel: 'problem, unified API, developer, reliability + economics, compliance, comparison, faq, cta present', informationRelationships: ['the uptime/economics metrics back the unified-API claim; compliance de-risks it'] },
    communication: { perceptualEntry: ['open on the roadmap stalled by stitching financial infrastructure'], beliefFormation: ['name the trap → show one API → satisfy the developer and the compliance reviewer with proof'], communicationEnergy: ['precise, technical-credible, commercially sharp'] },
    spatial: { spatialAllocation: ['hero states the one-API promise; the platform surface as a bento'], density: ['structured for a technical product leader'], spatialHierarchy: ['hero, then the API surface, then reliability + economics'] },
    visual: { perceivedImportanceAndStanding: ['uptime and kept-margin figures carry the proof weight'], perceivedAffordance: ['the solutions-engineer CTA reads as a consultative next step'] },
    experienceCharacter: { experienceCharacter: ['precise, reliable, infrastructure-grade'], creativePrinciples: ['developer-respecting; numbers and docs over adjectives'], behaviouralIdentity: ['dependable and exact, like good financial infrastructure'] },
  },
  cartage: {
    information: { informationPriorities: ['the spreadsheet-and-phone-call chaos is the lead; one control tower second'], completenessModel: 'problem, control tower, tender-to-delivery process, operational metrics, case study, integrations, faq, cta present', informationRelationships: ['the on-time/cost metrics validate the control-tower claim; the case study makes it real'] },
    communication: { perceptualEntry: ['open on freight still running on spreadsheets, calls, and hope'], beliefFormation: ['make the chaos vivid → show one control tower → prove on-time and cost gains'], communicationEnergy: ['operational, confident, logistics-credible'] },
    spatial: { spatialAllocation: ['hero shows one tower over every carrier; metrics in a dense ops band'], density: ['dense and scannable for a logistics operator'], spatialHierarchy: ['hero, then the control tower, then operational proof'] },
    visual: { perceivedImportanceAndStanding: ['the on-time-rate and cost-per-load figures dominate the proof'], perceivedAffordance: ['the network-assessment CTA reads as a concrete next step'] },
    experienceCharacter: { experienceCharacter: ['operational, calm-under-load, dependable'], creativePrinciples: ['proof in operational numbers, not promises'], behaviouralIdentity: ['steady and orchestrated, like a good control tower'] },
  },
};

// example-brand gets the id-referencing models too (governed reorder + full mechanism coverage).
function example-brandFull(): Authored {
  const ids = planIds('example-brand');
  // a governed reorder: lead with the hero, then problem → mechanism → features → proof → outcomes → cta → footer.
  const has = (s: string) => ids.find((i) => i.includes(s));
  const desired = ['hero', 'the-hidden-tax', 'how-a-digital-worker', 'features', 'metrics', 'outcomes', 'cta', 'footer']
    .map(has)
    .filter((x): x is string => !!x);
  // any ids not in the desired list keep their relative order at the end (exact-permutation safety).
  const order = [...desired, ...ids.filter((i) => !desired.includes(i))];
  const objectivesByKey: Record<string, string> = {
    hero: 'orient on the promise', 'the-hidden-tax': 'make the manual-work pain visceral', 'how-a-digital-worker': 'reveal the digital worker', features: 'show the capability surface', metrics: 'prove with measured numbers', outcomes: 'show first-quarter outcomes', cta: 'move to a demo', footer: 'close and reassure',
  };
  const purposeByKey: Record<string, string> = {
    hero: 'frame the core claim', 'the-hidden-tax': 'name the cost of manual glue work', 'how-a-digital-worker': 'explain the deployment mechanism', features: 'enumerate the capabilities', metrics: 'evidence the claim', outcomes: 'evidence the outcome', cta: 'convert the qualified reader', footer: 'navigation and trust close',
  };
  const respByKey: Record<string, string> = {
    hero: 'establish context and claim', 'the-hidden-tax': 'establish the problem', 'how-a-digital-worker': 'carry the core mechanism', features: 'carry the capability detail', metrics: 'evidence the claim', outcomes: 'evidence the outcome', cta: 'convert intent', footer: 'orient and reassure',
  };
  const keyOf = (id: string) => Object.keys(objectivesByKey).find((k) => id.includes(k)) ?? id;
  return {
    ...PAGE.example-brand,
    progression: {
      encounterSequence: order,
      progressionObjectives: order.map((id) => objectivesByKey[keyOf(id)] ?? 'advance the argument'),
    },
    mechanism: {
      requiredMechanisms: ids,
      purposes: ids.map((id) => purposeByKey[keyOf(id)] ?? 'serve the page'),
      responsibilities: ids.map((id) => respByKey[keyOf(id)] ?? 'carry its section'),
    },
  };
}

const CLIENTS = ['example-brand', 'halyard', 'veyra', 'forgeline', 'ledgerwise', 'cartage'];
for (const client of CLIENTS) {
  const authored = client === 'example-brand' ? example-brandFull() : PAGE[client];
  const drafts = expand(authored);
  const out = join(ROOT, client, 'references', 'governance-drafts.json');
  writeFileSync(out, JSON.stringify(drafts, null, 2), 'utf8');
  const filled = Object.values(authored).reduce((n, m) => n + Object.values(m).filter((v) => v !== null && v !== undefined).length, 0);
  console.log(`${client}: wrote ${out} (${filled} authored categories)`);
}
