import { describe, expect, it } from 'vitest';
import { planFlatten, planSectionLibrarySections, FLATTEN_RULES } from '../src/flatten.js';

describe('planFlatten', () => {
  it('maps brand-pack root files to the flat target root', () => {
    const plan = planFlatten(['brand-pack/ASSETS.md', 'brand-pack/colors_and_type.css', 'brand-pack/voice.md']);
    expect(plan.get('brand-pack/ASSETS.md')).toBe('ASSETS.md');
    expect(plan.get('brand-pack/colors_and_type.css')).toBe('colors_and_type.css');
    expect(plan.get('brand-pack/voice.md')).toBe('voice.md');
  });

  it('maps the new token-export files to the flat root beside colors_and_type.css', () => {
    const plan = planFlatten(['brand-pack/theme.css', 'brand-pack/tokens.json', 'brand-pack/variables.css']);
    expect(plan.get('brand-pack/theme.css')).toBe('theme.css');
    expect(plan.get('brand-pack/tokens.json')).toBe('tokens.json');
    expect(plan.get('brand-pack/variables.css')).toBe('variables.css');
  });

  it('mirrors brand-pack/assets/** and brand-pack/fonts/** verbatim under assets/ and fonts/', () => {
    const plan = planFlatten([
      'brand-pack/assets/imagery/avatars/avatar-carol.jpg',
      'brand-pack/assets/logo/logo-color.svg',
      'brand-pack/fonts/Inter-Bold.ttf',
    ]);
    expect(plan.get('brand-pack/assets/imagery/avatars/avatar-carol.jpg')).toBe(
      'assets/imagery/avatars/avatar-carol.jpg',
    );
    expect(plan.get('brand-pack/assets/logo/logo-color.svg')).toBe('assets/logo/logo-color.svg');
    expect(plan.get('brand-pack/fonts/Inter-Bold.ttf')).toBe('fonts/Inter-Bold.ttf');
  });

  it('renames brand-pack/exemplars/README.md to exemplars/README.md and mirrors pages/', () => {
    const plan = planFlatten([
      'brand-pack/exemplars/README.md',
      'brand-pack/exemplars/_frozen-v2-tokens.css',
      'brand-pack/exemplars/pages/ai-strategy-v2.html',
    ]);
    expect(plan.get('brand-pack/exemplars/README.md')).toBe('exemplars/README.md');
    expect(plan.get('brand-pack/exemplars/_frozen-v2-tokens.css')).toBe('exemplars/_frozen-v2-tokens.css');
    expect(plan.get('brand-pack/exemplars/pages/ai-strategy-v2.html')).toBe('exemplars/pages/ai-strategy-v2.html');
  });

  it('EXCLUDES brand-pack/exemplars/sections/** — the frozen v2 archive is not the canonical source', () => {
    const plan = planFlatten(['brand-pack/exemplars/sections/component-hero-bento.html']);
    expect(plan.get('brand-pack/exemplars/sections/component-hero-bento.html')).toBeNull();
  });

  it('renames governance/website/exemplars/README.md to exemplars/inspiration-README.md and mirrors inspiration/', () => {
    const plan = planFlatten([
      'governance/website/exemplars/README.md',
      'governance/website/exemplars/inspiration/inspiration-1.jpg',
    ]);
    expect(plan.get('governance/website/exemplars/README.md')).toBe('exemplars/inspiration-README.md');
    expect(plan.get('governance/website/exemplars/inspiration/inspiration-1.jpg')).toBe(
      'exemplars/inspiration/inspiration-1.jpg',
    );
  });

  it('flattens governance/website/*.md (direct children only) to the target root', () => {
    const plan = planFlatten(['governance/website/OVERVIEW.md', 'governance/website/BRAND_EXPRESSION.md']);
    expect(plan.get('governance/website/OVERVIEW.md')).toBe('OVERVIEW.md');
    expect(plan.get('governance/website/BRAND_EXPRESSION.md')).toBe('BRAND_EXPRESSION.md');
  });

  it('mirrors component-governance/**, foundation/**, rulebooks/** — but excludes verify-library.py', () => {
    const plan = planFlatten([
      'governance/website/component-governance/COMPOSE.md',
      'governance/website/component-governance/COMPOSITION.md',
      'governance/website/component-governance/components.md',
      'governance/website/component-governance/verify-library.py',
      'governance/website/foundation/COLOUR.md',
      'governance/website/rulebooks/creatives.md',
    ]);
    expect(plan.get('governance/website/component-governance/COMPOSE.md')).toBe('component-governance/COMPOSE.md');
    expect(plan.get('governance/website/component-governance/COMPOSITION.md')).toBe(
      'component-governance/COMPOSITION.md',
    );
    expect(plan.get('governance/website/component-governance/components.md')).toBe(
      'component-governance/components.md',
    );
    expect(plan.get('governance/website/component-governance/verify-library.py')).toBeNull();
    expect(plan.get('governance/website/foundation/COLOUR.md')).toBe('foundation/COLOUR.md');
    expect(plan.get('governance/website/rulebooks/creatives.md')).toBe('rulebooks/creatives.md');
  });

  it('maps governance/DECISION-REGISTER.md to the flat root', () => {
    const plan = planFlatten(['governance/DECISION-REGISTER.md']);
    expect(plan.get('governance/DECISION-REGISTER.md')).toBe('DECISION-REGISTER.md');
  });

  it('EXCLUDES governance/collateral/**, governance/deck/**, output/**, and everything under section-library/ except sections/', () => {
    const plan = planFlatten([
      'governance/collateral/_MISSING.md',
      'governance/deck/_BLOCKED.md',
      'output/verify.py',
      'section-library/README.md',
      'section-library/MIGRATION.md',
      'section-library/_v2/hero-bento.html',
      '.DS_Store',
    ]);
    for (const [, target] of plan) expect(target).toBeNull();
    expect(plan.size).toBe(7);
  });

  it('mirrors brand-pack/elements/** verbatim under elements/', () => {
    const plan = planFlatten(['brand-pack/elements/Approach 1.svg', 'brand-pack/elements/Arrow 6.svg']);
    expect(plan.get('brand-pack/elements/Approach 1.svg')).toBe('elements/Approach 1.svg');
    expect(plan.get('brand-pack/elements/Arrow 6.svg')).toBe('elements/Arrow 6.svg');
  });

  it('EXCLUDES design/website\'s own top-level process docs — not engine governance content', () => {
    const plan = planFlatten(['DEV-HANDOFF.md', 'MANIFEST.md', 'README.md']);
    expect(plan.get('DEV-HANDOFF.md')).toBeNull();
    expect(plan.get('MANIFEST.md')).toBeNull();
    expect(plan.get('README.md')).toBeNull();
  });

  it('reports a source file that matches no rule as unmapped, never silently drops it', () => {
    const plan = planFlatten(['some/genuinely/new/unrecognized-path.md']);
    expect(plan.get('some/genuinely/new/unrecognized-path.md')).toBe(undefined);
  });

  it('every rule in FLATTEN_RULES is well-formed (file/dir/dir-shallow, to is string or null)', () => {
    for (const rule of FLATTEN_RULES) {
      expect(['file', 'dir', 'dir-shallow']).toContain(rule.kind);
      if (rule.kind !== 'file') expect(rule.from.endsWith('/')).toBe(true);
      if (rule.to !== null && rule.kind !== 'file') {
        expect(rule.to === '' || rule.to.endsWith('/')).toBe(true);
      }
    }
  });
});

describe('planSectionLibrarySections', () => {
  it('maps an unrenamed section straight through with the component- prefix restored', () => {
    const plan = planSectionLibrarySections(['section-library/sections/hero-bento.html']);
    expect(plan.get('section-library/sections/hero-bento.html')).toBe(
      'exemplars/sections/component-hero-bento.html',
    );
  });

  it('maps a RENAMED section back to its old, engine-resolvable filename', () => {
    const plan = planSectionLibrarySections(['section-library/sections/accordion-panel-right.html']);
    expect(plan.get('section-library/sections/accordion-panel-right.html')).toBe(
      'exemplars/sections/component-feature-accordion.html',
    );
  });

  it('ignores anything not directly under section-library/sections/', () => {
    const plan = planSectionLibrarySections(['section-library/_v2/hero-bento.html', 'brand-pack/ASSETS.md']);
    expect(plan.size).toBe(0);
  });
});
