/**
 * Stage 3 — authoring-seam.ts tests.
 *
 * Coverage:
 *  (a) scriptedAuthor — string / array / function forms (mirror scripted-actuator.test.ts)
 *  (b) scriptedAuthor exhaustion policies ('last' and 'passthrough')
 *  (c) createSubagentAuthor — writes request file AND canned fragment flows through
 *      (only coverage the LLM-path plumbing ever gets in CI)
 *  (d) createSubagentAuthor — writeRequestFile:false skips the file
 *  (e) defaultScriptedAuthor — returns a non-empty fragment with a known token var()
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scriptedAuthor,
  createSubagentAuthor,
  defaultScriptedAuthor,
  pasteVerbatimAuthor,
} from '../src/generate/authoring-seam.js';
import type { AuthoringRequest, AuthorDispatch } from '../src/generate/authoring-seam.js';

// ── Fixture request ───────────────────────────────────────────────────────────

const ITEM = {
  anchor: { id: 'hero', anchor: 'hero' },
  archetype: 'hero' as const,
  tokenRoles: ['--cr-electric', '--cr-charcoal'],
  intent: 'Primary value proposition',
};

const REQ: AuthoringRequest = {
  item: ITEM,
  guidance: '',
  oneLiner: 'Test product',
  tone: 'confident',
};

// ── Temp dir cleanup ──────────────────────────────────────────────────────────

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-author-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

// ── (a) scriptedAuthor — basic forms ─────────────────────────────────────────

describe('scriptedAuthor — string form', () => {
  it('returns the same string for every call', async () => {
    const a = scriptedAuthor('<fixed/>');
    expect(await a.author(REQ)).toBe('<fixed/>');
    expect(await a.author(REQ)).toBe('<fixed/>');
  });
});

describe('scriptedAuthor — array form', () => {
  it('replays ordered responses by call index', async () => {
    const a = scriptedAuthor(['<a/>', '<b/>', '<c/>']);
    expect(await a.author(REQ)).toBe('<a/>');
    expect(await a.author(REQ)).toBe('<b/>');
    expect(await a.author(REQ)).toBe('<c/>');
  });
});

describe('scriptedAuthor — function form', () => {
  it('supports a function receiving the request and 0-based call index', async () => {
    const a = scriptedAuthor((req: AuthoringRequest, call: number) => `${req.item.anchor.id}-${call}`);
    expect(await a.author(REQ)).toBe('hero-0');
    expect(await a.author(REQ)).toBe('hero-1');
  });
});

// ── (b) scriptedAuthor — exhaustion policies ──────────────────────────────────

describe('scriptedAuthor — exhaustion: last (default)', () => {
  it("replays the final entry after the script is exhausted", async () => {
    const a = scriptedAuthor(['<a/>', '<b/>']);
    await a.author(REQ);
    await a.author(REQ);
    expect(await a.author(REQ)).toBe('<b/>');
  });
});

describe('scriptedAuthor — exhaustion: passthrough', () => {
  it("returns '' after exhaustion when onExhausted='passthrough'", async () => {
    const a = scriptedAuthor(['<a/>'], 'passthrough');
    await a.author(REQ); // consumes the single entry
    expect(await a.author(REQ)).toBe('');
  });
});

// ── (c) createSubagentAuthor — writes request file, passes fragment through ───

describe('createSubagentAuthor — request file and dispatch plumbing', () => {
  it('writes <item-id>.request.md and returns the dispatch output', async () => {
    const dispatchDir = freshDir();
    const fakeDispatch: AuthorDispatch = async (_req) => '<section>authored</section>';
    const a = createSubagentAuthor({ dispatchDir, dispatch: fakeDispatch });

    const fragment = await a.author(REQ);
    expect(fragment).toBe('<section>authored</section>');

    const reqPath = join(dispatchDir, 'hero.request.md');
    expect(existsSync(reqPath)).toBe(true);
  });

  it('request file contains the item id, archetype, intent, and oneLiner', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({
      dispatchDir,
      dispatch: async (_req) => '',
    });
    await a.author(REQ);

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).toContain('hero');           // section id
    expect(written).toContain('hero');           // archetype
    expect(written).toContain('Primary value proposition'); // intent
    expect(written).toContain('Test product');   // oneLiner
    expect(written).toContain('confident');      // tone
  });

  it('passes the full AuthoringRequest to the dispatch callback', async () => {
    const dispatchDir = freshDir();
    let seen: AuthoringRequest | undefined;
    const a = createSubagentAuthor({
      dispatchDir,
      dispatch: async (req) => { seen = req; return ''; },
    });
    await a.author(REQ);
    expect(seen?.item.anchor.id).toBe('hero');
    expect(seen?.item.archetype).toBe('hero');
    expect(seen?.oneLiner).toBe('Test product');
  });

  it('request file names the file after the item id (hero.request.md)', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(REQ);
    expect(existsSync(join(dispatchDir, 'hero.request.md'))).toBe(true);
  });

  it('names a footer request file after the footer id', async () => {
    const dispatchDir = freshDir();
    const footerReq: AuthoringRequest = {
      ...REQ,
      item: {
        anchor: { id: 'footer', anchor: 'footer', landmark: 'contentinfo' },
        archetype: 'footer' as const,
        tokenRoles: [],
        intent: 'Footer',
      },
    };
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(footerReq);
    expect(existsSync(join(dispatchDir, 'footer.request.md'))).toBe(true);
  });

  it('request file mentions token roles', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(REQ);
    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).toContain('--cr-electric');
    expect(written).toContain('--cr-charcoal');
  });
});

// ── (d) createSubagentAuthor — writeRequestFile:false ────────────────────────

describe('createSubagentAuthor — writeRequestFile:false', () => {
  it('skips the request file when writeRequestFile is false', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({
      dispatchDir,
      writeRequestFile: false,
      dispatch: async () => '',
    });
    await a.author(REQ);
    expect(existsSync(join(dispatchDir, 'hero.request.md'))).toBe(false);
  });
});

// ── (e) defaultScriptedAuthor ─────────────────────────────────────────────────

describe('defaultScriptedAuthor', () => {
  it('returns a non-empty HTML fragment', async () => {
    const a = defaultScriptedAuthor();
    const frag = await a.author(REQ);
    expect(frag.length).toBeGreaterThan(0);
    expect(frag).toContain('<section');
  });

  it('fragment contains the item id as the element id', async () => {
    const a = defaultScriptedAuthor();
    const frag = await a.author(REQ);
    expect(frag).toContain('id="hero"');
  });

  it('fragment references a token var() from tokenRoles', async () => {
    const a = defaultScriptedAuthor();
    const frag = await a.author(REQ);
    expect(frag).toContain('var(--cr-electric)');
  });

  it('fragment includes the intent as a heading text', async () => {
    const a = defaultScriptedAuthor();
    const frag = await a.author(REQ);
    expect(frag).toContain('Primary value proposition');
  });

  it('footer fragment includes the landmark role', async () => {
    const a = defaultScriptedAuthor();
    const footerReq: AuthoringRequest = {
      ...REQ,
      item: {
        anchor: { id: 'footer', anchor: 'footer', landmark: 'contentinfo' },
        archetype: 'footer' as const,
        tokenRoles: [],
        intent: 'Footer',
      },
    };
    const frag = await a.author(footerReq);
    expect(frag).toContain('role="contentinfo"');
  });

  it('HTML-escapes intent text with special characters', async () => {
    const a = defaultScriptedAuthor();
    const req: AuthoringRequest = {
      ...REQ,
      item: {
        ...ITEM,
        intent: 'Pricing & plans for <teams>',
      },
    };
    const frag = await a.author(req);
    // Must not emit raw & or < in the heading
    expect(frag).not.toContain('Pricing & plans for <teams>');
    expect(frag).toContain('&amp;');
    expect(frag).toContain('&lt;');
  });

  it('emits no hardcoded hex colours (no #nnnnnn literals)', async () => {
    const a = defaultScriptedAuthor();
    const frag = await a.author(REQ);
    expect(frag).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
  });
});

// ── (f) briefContent — the section-content block in request.md ────────────────

describe('renderAuthorRequest — Section content block (briefContent)', () => {
  const SECTION_COPY = [
    '## 2. How It Works',
    '- ① UNDERSTAND — a discovery interview, not a prompt.',
    '- Load-bearing idea — cross-model verification: producer is never the checker.',
  ].join('\n');

  it('renders the brief content verbatim under a "Section content" heading', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, briefContent: SECTION_COPY });

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).toContain('## Section content');
    expect(written).toContain('UNDERSTAND — a discovery interview');
    expect(written).toContain('cross-model verification: producer is never the checker');
  });

  it('frames the content as authoritative substance to typeset, not invent', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, briefContent: SECTION_COPY });

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    // The steering lever: render THIS substance, do not invent competing facts.
    expect(written).toMatch(/author THIS/i);
    expect(written).toMatch(/do not.*invent|invent.*do not|never.*invent/i);
  });

  it('omits the Section content block entirely when briefContent is absent', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(REQ); // no briefContent

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).not.toContain('## Section content');
  });

  it('places Section content after Section intelligence and before How to respond', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, guidance: 'Some §3.N guidance.', briefContent: SECTION_COPY });

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    const si = written.indexOf('## Section intelligence');
    const sc = written.indexOf('## Section content');
    const htr = written.indexOf('## How to respond');
    expect(si).toBeGreaterThanOrEqual(0);
    expect(sc).toBeGreaterThan(si);
    expect(htr).toBeGreaterThan(sc);
  });

  it('scripted author ignores briefContent (no fragment change)', async () => {
    const a = defaultScriptedAuthor();
    const withContent = await a.author({ ...REQ, briefContent: SECTION_COPY });
    const without = await defaultScriptedAuthor().author(REQ);
    expect(withContent).toBe(without);
  });
});

// ── (WS5 E1) flagship visual page — request marker + exemplar pointer ──────────
describe('renderAuthorRequest — flagship visual block (WS5)', () => {
  const FLAGSHIP_REQ: AuthoringRequest = {
    item: {
      anchor: { id: 'topology', anchor: 'topology' },
      archetype: 'ContentPage',
      tokenRoles: [],
      intent: 'How the nodes connect in the topology',
      composition: 'RELATIONSHIP DIAGRAM — a substantial hand-authored inline-SVG diagram (`.cr-graphic`).',
      flagshipVisual: true,
    },
    guidance: '',
    oneLiner: 'Test product',
    tone: 'confident',
  };

  it('a flagship page request carries the "Flagship: yes" marker and the exemplar pointer path', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(FLAGSHIP_REQ);

    const written = readFileSync(join(dispatchDir, 'topology.request.md'), 'utf8');
    expect(written).toMatch(/Flagship: yes/);
    expect(written).toMatch(/~150mm/);
    // diagram signal → hub-spoke exemplar pointer (existence-checked, present on disk).
    expect(written).toContain('exemplars/diagrams/hub-spoke.html');
  });

  it('a non-flagship page request omits the flagship block', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(REQ); // no flagshipVisual

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).not.toMatch(/Flagship: yes/);
  });

  // ── W53 — Presentation Intent CONSUMPTION (flagship exemplar pointer) ──────────
  // FLAGSHIP_REQ's real intent text ("How the nodes connect in the topology") derives
  // only a 'diagram' cue (no 'comparison') — so a fresh derivation resolves to the
  // hub-spoke default, exactly as proven above. Attaching a fabricated PresentationIntent
  // whose source claims 'comparison' must flip the pointer to the comparison exemplar
  // ONLY if buildFlagshipBlock truly reads item.presentationIntent instead of re-deriving.
  it('resolves the flagship exemplar pointer from a transported PresentationIntent instead of re-deriving from content', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    const req: AuthoringRequest = {
      ...FLAGSHIP_REQ,
      item: {
        ...FLAGSHIP_REQ.item,
        presentationIntent: Object.freeze({
          intentClass: 'diagram',
          commitment: 'dominant',
          source: Object.freeze(['comparison']),
          digest: 'w53-fabricated-fixture',
          validationState: 'valid',
        }) as NonNullable<AuthoringRequest['item']['presentationIntent']>,
      },
    };
    await a.author(req);

    const written = readFileSync(join(dispatchDir, 'topology.request.md'), 'utf8');
    expect(written).toContain('exemplars/diagrams/comparison.html');
    expect(written).not.toContain('exemplars/diagrams/hub-spoke.html');
  });
});

// ── W54 — Data Visualization parity: the study-pointer block's framing must be
// correct for a CHART pointer, not just diagram/spatial. A chart is realized per
// README-DATA-VIZ.md as a doc-scoped `.viz-*` chart or metric visualization — NOT
// necessarily inline SVG in a `.cr-graphic` (the diagram/spatial framing), so a chart
// pointer must get its own correct instruction, not the diagram/spatial wording verbatim.
describe('renderAuthorRequest — study pointer block framing (W54 chart parity)', () => {
  it('a chart study pointer (data-visualization/...) gets data-viz framing, not the diagram/spatial ".cr-graphic" instruction', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, studyPointer: 'data-visualization/benchmark-bars.html' });

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).toContain('exemplars/data-visualization/benchmark-bars.html');
    expect(written).toMatch(/README-DATA-VIZ/);
    expect(written).not.toMatch(/inline SVG in a `\.cr-graphic`/);
  });

  it('a diagram/spatial study pointer keeps its existing ".cr-graphic" framing unchanged', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, studyPointer: 'diagrams/hub-spoke.html' });

    const written = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(written).toMatch(/inline SVG in a `\.cr-graphic`/);
    expect(written).not.toMatch(/README-DATA-VIZ/);
  });
});

// ── (P3) base fragment — edit-in-place dispatch + paste-verbatim double ────────

const BASE_FRAGMENT = [
  '<section id="hero" data-crf="hero-actions">',
  '  <style>[data-crf="hero-actions"] .h { color: var(--cr-fg); }</style>',
  '  <h1 class="h cr-h-hero">Donor headline — Acme placeholder</h1>',
  '  <a class="cr-btn">Start free trial →</a>',
  '</section>',
].join('\n');

describe('renderAuthorRequest — base fragment (edit-in-place) block (P3)', () => {
  it('writes <id>.base.html beside the request when baseFragment is present', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, baseFragment: BASE_FRAGMENT });
    const basePath = join(dispatchDir, 'hero.base.html');
    expect(existsSync(basePath)).toBe(true);
    expect(readFileSync(basePath, 'utf8')).toBe(BASE_FRAGMENT);
  });

  it('renders the inverted "edit THIS in place" instruction (not "do not clone")', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, baseFragment: BASE_FRAGMENT });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toMatch(/EDIT THIS IN PLACE/i);
    expect(md).toMatch(/Replace ONLY the copy/i);
    expect(md).toMatch(/never strip the wrapper|keep its.*data-crf/i);
    // the contradictory "reference exemplar — do NOT clone" framing is suppressed here
    expect(md).not.toMatch(/do NOT clone this layout/i);
    // the base fragment body is embedded for the subagent to edit
    expect(md).toContain('data-crf="hero-actions"');
  });

  it('keeps the exemplar ("do not clone") framing when there is NO base fragment', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, exemplar: '<section>exemplar</section>' });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toMatch(/do NOT clone this layout/i);
    expect(md).not.toMatch(/EDIT THIS IN PLACE/i);
    expect(existsSync(join(dispatchDir, 'hero.base.html'))).toBe(false);
  });
});

describe('pasteVerbatimAuthor (Path C website smoke double)', () => {
  it('returns the base fragment VERBATIM when present (no copy edit)', async () => {
    const frag = await pasteVerbatimAuthor().author({ ...REQ, baseFragment: BASE_FRAGMENT });
    expect(frag).toBe(BASE_FRAGMENT);
  });

  it('falls back to a minimal fragment when no base fragment is present', async () => {
    const frag = await pasteVerbatimAuthor().author(REQ);
    expect(frag).toContain('<section');
    expect(frag).toContain('id="hero"');
  });
});

// ── (P3) cold-subagent edit harness — the non-circular edit-in-place proof ─────
// A double standing in for the in-session LLM: it edits the base fragment's COPY in
// place (placeholder → brief substance) while keeping structure + scoping. This is the
// shape the real subagent must satisfy; the assertions are the gate the cold run meets.

describe('edit-in-place authoring (cold-subagent shape)', () => {
  /** An "editing author" double: replace the donor copy with the brief substance, keep scoping. */
  const editingAuthor = scriptedAuthor((req: AuthoringRequest) => {
    const base = req.baseFragment ?? '';
    return base
      .replace('Donor headline — Acme placeholder', 'Ship on-brand pages in minutes')
      .replace('Start free trial →', 'Book a demo →');
  });

  it('edits copy to the brief substance with the data-crf wrapper + scoped <style> intact', async () => {
    const out = await editingAuthor.author({ ...REQ, baseFragment: BASE_FRAGMENT });
    // structure + scoping preserved
    expect(out).toMatch(/data-crf="hero-actions"/);
    expect(out).toContain('<style>');
    expect(out).toContain('cr-h-hero');
    // copy is the brief substance
    expect(out).toContain('Ship on-brand pages in minutes');
    expect(out).toContain('Book a demo →');
    // ZERO placeholder / donor-copy leaks
    expect(out).not.toContain('Acme');
    expect(out).not.toContain('Donor headline');
    expect(out).not.toMatch(/lorem/i);
  });
});

// ── (P43) brand-owned regions block — the sole BrandOwnedRegions consumer ──────

describe('renderAuthorRequest — brand-owned regions block (P43)', () => {
  it('renders a brand-owned-regions block when the base fragment has declared regions', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, item: { ...ITEM, fragmentId: 'hero-bento' }, baseFragment: BASE_FRAGMENT });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toMatch(/Brand-owned elements in this fragment/i);
    expect(md).toContain('.hb-logo');
    expect(md).toMatch(/never ship Example Brand/i);
  });

  it('renders nothing when the fragment has no declared brand-owned regions', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, item: { ...ITEM, fragmentId: 'stat-cards' }, baseFragment: BASE_FRAGMENT });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).not.toMatch(/Brand-owned elements in this fragment/i);
  });

  it('renders nothing when there is no fragmentId at all', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, baseFragment: BASE_FRAGMENT });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).not.toMatch(/Brand-owned elements in this fragment/i);
  });

  it('renders nothing when there is no base fragment (collateral / exemplar path)', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({
      ...REQ,
      item: { ...ITEM, fragmentId: 'hero-bento' },
      exemplar: '<section>x</section>',
    });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).not.toMatch(/Brand-owned elements in this fragment/i);
  });

  it('pasteVerbatimAuthor is untouched by the new block — it never renders a request', async () => {
    const frag = await pasteVerbatimAuthor().author({
      ...REQ,
      item: { ...ITEM, fragmentId: 'hero-bento' },
      baseFragment: BASE_FRAGMENT,
    });
    expect(frag).toBe(BASE_FRAGMENT);
  });
});

// ── (Sprint 6) subagent author — Creative Artifact composition ─────────────────
// The scripted path already embeds item.creativeArtifact via minimalFragment (Sprint 5).
// This closes the matching gap on the LLM/subagent path: the request must tell the author
// a selected visual is available, point it at the exact bytes (a sibling file, never inlined
// into the markdown — the data: URI can be tens of KB), and require it preserve the two
// data-creative-artifact-* attributes so consumption stays mechanically greppable regardless
// of which author produced the markup.

const CREATIVE_ARTIFACT_REF = {
  id: 'exception-triage-queue',
  intentDigest: 'sha256:' + 'a'.repeat(64),
  artifactDigest: 'sha256:' + 'b'.repeat(64),
  location: 'projects/example-brand-apa/creative-assets/exception-triage-queue/visual.html',
};
const CREATIVE_ARTIFACT_IMAGE = 'data:image/svg+xml;base64,AAAABBBBCCCC';

describe('renderAuthorRequest — Creative Artifact block (Sprint 6)', () => {
  it('writes <id>.creative-artifact.txt beside the request, containing the raw data URI', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({
      ...REQ,
      item: { ...ITEM, creativeArtifact: CREATIVE_ARTIFACT_REF },
      creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE,
    });
    const p = join(dispatchDir, 'hero.creative-artifact.txt');
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, 'utf8')).toBe(CREATIVE_ARTIFACT_IMAGE);
  });

  it('references the artifact id/digest and instructs embedding the exact sibling-file bytes', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({
      ...REQ,
      item: { ...ITEM, creativeArtifact: CREATIVE_ARTIFACT_REF },
      creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE,
    });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toContain('exception-triage-queue');
    expect(md).toContain(CREATIVE_ARTIFACT_REF.artifactDigest);
    expect(md).toContain('hero.creative-artifact.txt');
    expect(md).toMatch(/data-creative-artifact-id/);
    expect(md).toMatch(/data-creative-artifact-digest/);
    expect(md).toMatch(/do not invent, fetch, or rehost a different/i);
  });

  it('renders nothing when there is no creativeArtifactImage (byte-identical to before Sprint 6)', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author(REQ);
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).not.toMatch(/Creative Artifact/);
    expect(existsSync(join(dispatchDir, 'hero.creative-artifact.txt'))).toBe(false);
  });

  it('renders nothing when creativeArtifactImage is present but item.creativeArtifact is absent', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await a.author({ ...REQ, creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).not.toMatch(/Creative Artifact/);
    expect(existsSync(join(dispatchDir, 'hero.creative-artifact.txt'))).toBe(false);
  });

  it('scriptedAuthor / defaultScriptedAuthor are untouched — they never render a request', async () => {
    const frag = await defaultScriptedAuthor().author({
      ...REQ,
      item: { ...ITEM, creativeArtifact: CREATIVE_ARTIFACT_REF },
      creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE,
    });
    expect(frag).toContain('data-creative-artifact-id="exception-triage-queue"');
  });
});

// ── (Sprint 6) pasteVerbatimAuthor — Creative Artifact mechanical trace ────────
// assembleWebsiteBySelection (the REAL production website authoring path — scripts/generate.ts)
// uses pasteVerbatimAuthor, NOT minimalFragment/defaultScriptedAuthor. Without this, a selected
// Creative Artifact could never mechanically reach website CLI output on the scripted path — the
// verbatim-paste double would silently drop it. The paste of `baseFragment` itself stays byte-exact
// (that guarantee is load-bearing for the curation gate); only the marker is appended alongside it.
describe('pasteVerbatimAuthor — Creative Artifact mechanical trace (Sprint 6)', () => {
  it('appends the creative-artifact marker after the verbatim-pasted base fragment', async () => {
    const frag = await pasteVerbatimAuthor().author({
      ...REQ,
      item: { ...ITEM, creativeArtifact: CREATIVE_ARTIFACT_REF },
      baseFragment: BASE_FRAGMENT,
      creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE,
    });
    expect(frag).toContain(BASE_FRAGMENT);
    expect(frag).toContain(`data-creative-artifact-id="${CREATIVE_ARTIFACT_REF.id}"`);
    expect(frag).toContain(`data-creative-artifact-digest="${CREATIVE_ARTIFACT_REF.artifactDigest}"`);
    expect(frag).toContain(`src="${CREATIVE_ARTIFACT_IMAGE}"`);
  });

  it('leaves the base fragment byte-identical when no creative artifact is selected (regression)', async () => {
    const frag = await pasteVerbatimAuthor().author({ ...REQ, baseFragment: BASE_FRAGMENT });
    expect(frag).toBe(BASE_FRAGMENT);
  });

  it('falls back to minimalFragment (which embeds its own marker) when no base fragment is present', async () => {
    const frag = await pasteVerbatimAuthor().author({
      ...REQ,
      item: { ...ITEM, creativeArtifact: CREATIVE_ARTIFACT_REF },
      creativeArtifactImage: CREATIVE_ARTIFACT_IMAGE,
    });
    expect(frag).toContain('data-creative-artifact-id="exception-triage-queue"');
  });
});
