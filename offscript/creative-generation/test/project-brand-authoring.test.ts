import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCreativeAuthoringPrompt, parseCreativeAuthoringResponse, validateAuthoredCreative } from '../src/creative-authoring.js';
import { runCli } from '../src/cli.js';
import { engineRoot } from '../src/references.js';
import { loadProjectAuthoringBrand } from '../src/brand-typography.js';

const CSS = ':root{--client-accent:#150580;--client-font:"Georgia",serif}.client-ui{font-family:var(--client-font);font-weight:550;color:var(--client-accent)}';
const VOICE = 'Warm & expressive! Use lowercase headlines, emoji and em dashes — welcome them.';
const REQUEST = { belief: 'Make work flow', feature: 'automation', mustInclude: ['workflow'], ratio: '4:3', components: ['workflow builder'] };
const PROJECT_REQUEST = { ...REQUEST, brand: { css: CSS, voice: VOICE } };
const HTML = '<!doctype html><html><head><style>.client-ui{font-family:"Georgia",serif;font-weight:550}</style></head><body><div id="cr-artifact-visual"><div data-component="workflow builder">hello & welcome — 🚀!</div></div></body></html>';
const cleanup: string[] = [];
afterEach(() => { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function projectReferences(css: string): { client: string; refs: string } {
  const client = `creative-brand-assets-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const project = join(engineRoot, 'projects', client);
  const refs = join(project, 'references');
  cleanup.push(project);
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), css);
  return { client, refs };
}

describe('project CSS assets travel with the creative', () => {
  it('embeds local font and image bytes relative to references while keeping the prompt free of binary data', () => {
    const css = '@font-face{font-family:"Custom";src:url("fonts/Custom.woff2")} .client-ui{background:url(images/paper.png)}';
    const { client, refs } = projectReferences(css);
    mkdirSync(join(refs, 'fonts'));
    mkdirSync(join(refs, 'images'));
    const font = Buffer.from('supplied custom font bytes');
    const picture = Buffer.from('supplied image bytes');
    writeFileSync(join(refs, 'fonts', 'Custom.woff2'), font);
    writeFileSync(join(refs, 'images', 'paper.png'), picture);
    const request = { ...REQUEST, brand: loadProjectAuthoringBrand(client) };
    expect(buildCreativeAuthoringPrompt(request)).toContain(css);
    expect(buildCreativeAuthoringPrompt(request)).not.toContain(font.toString('base64'));
    const outcome = parseCreativeAuthoringResponse(HTML, request);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') {
      expect(outcome.html).toContain(`data:font/woff2;base64,${font.toString('base64')}`);
      expect(outcome.html).toContain(`data:image/png;base64,${picture.toString('base64')}`);
      expect(outcome.html).not.toContain('url("fonts/Custom.woff2")');
    }
  });

  it('leaves external, data and hash references unchanged', () => {
    const css = '.a{background:url(https://example.com/a.png)}.b{background:url(//example.com/b.png)}.c{background:url(data:image/png;base64,eA==)}.d{filter:url(#filter)}';
    const { client } = projectReferences(css);
    expect(loadProjectAuthoringBrand(client)).toMatchObject({ css, embeddedCss: css });
  });

  it('fails clearly for a missing declared local asset', () => {
    const { client } = projectReferences('@font-face{src:url(fonts/missing.woff2)}');
    expect(() => loadProjectAuthoringBrand(client)).toThrow(/asset.*not found.*fonts\/missing\.woff2/i);
  });

  it('refuses to read a CSS asset outside the project references', () => {
    const { client } = projectReferences('.a{background:url(../outside.png)}');
    expect(() => loadProjectAuthoringBrand(client)).toThrow(/within project references/i);
  });
});

describe('creative authoring respects supplied project branding', () => {
  it('carries supplied CSS and voice without imposing bundled typography or environment taste', () => {
    const prompt = buildCreativeAuthoringPrompt(PROJECT_REQUEST);
    expect(prompt).toContain(CSS);
    expect(prompt).toContain(VOICE);
    expect(prompt).not.toMatch(/Instrument Sans|#FF7926|brand law|no shadows|zero border-radius/);
  });

  it('allows client font families and variable-font weight steps', () => {
    expect(validateAuthoredCreative(HTML, PROJECT_REQUEST)).toEqual({ valid: true });
  });

  it('embeds supplied CSS without adding the bundled font', () => {
    const outcome = parseCreativeAuthoringResponse(HTML, PROJECT_REQUEST);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') {
      expect(outcome.html).toContain(CSS);
      expect(outcome.html).not.toContain('Instrument Sans');
      expect(outcome.html).not.toMatch(/data:font\/ttf;base64/);
    }
  });

  it('does not turn missing project branding into an implicit reference brand', () => {
    expect(buildCreativeAuthoringPrompt(REQUEST)).not.toContain('Instrument Sans');
    expect(validateAuthoredCreative(HTML, REQUEST)).toEqual({ valid: true });
    const outcome = parseCreativeAuthoringResponse(HTML, REQUEST);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') expect(outcome.html).not.toContain('Instrument Sans');
  });

  it.each([true, false])('CLI --client routes supplied voice (manifest pointer: %s) into real author dispatch', async (manifestPointer) => {
    const client = `creative-brand-${process.pid}-${Math.random().toString(36).slice(2)}`;
    const project = join(engineRoot, 'projects', client);
    const refs = join(project, 'references');
    cleanup.push(project);
    mkdirSync(refs, { recursive: true });
    writeFileSync(join(refs, 'colors_and_type.css'), CSS);
    writeFileSync(join(refs, manifestPointer ? 'tone.md' : 'voice.md'), VOICE);
    if (manifestPointer) writeFileSync(join(refs, 'brand-kit.json'), JSON.stringify({ schemaVersion: 1, voiceReference: 'tone.md' }));
    const dispatch = mkdtempSync(join(tmpdir(), 'creative-client-dispatch-'));
    cleanup.push(dispatch);
    const intent = join(dispatch, 'creative-intent.json');
    writeFileSync(intent, JSON.stringify({ id: 'client-author', digest: 'sha256:' + 'a'.repeat(64), belief: REQUEST.belief, feature: REQUEST.feature, ratio: REQUEST.ratio, camera: 'product', 'must-include': REQUEST.mustInclude, 'content-provenance': 'human' }));
    writeFileSync(join(dispatch, 'client-author.judge-0.response.json'), JSON.stringify({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true, evidence: 'fixture judgment' }));
    const code = await runCli(['generate', '--creative-intent', intent, '--client', client, '--dispatch-dir', dispatch], { log: () => {}, error: () => {} });
    expect(code).toBe(3);
    const prompt = readFileSync(join(dispatch, 'client-author.authoring.prompt.md'), 'utf8');
    expect(prompt).toContain(CSS);
    expect(prompt).toContain(VOICE);
    expect(prompt).not.toContain('Instrument Sans');
  });
});
