import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}]/u;

function collectText(tree: Root): string {
  let out = '';
  const walk = (n: any): void => {
    if (n.type === 'text') out += n.value;
    if (n.children) for (const c of n.children) walk(c);
  };
  walk(tree);
  return out;
}

export const noEmoji: Operator = {
  name: 'no-emoji',
  tier: 0,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    const t = collectText(tree);
    const hits = [...t].filter((ch) => EMOJI.test(ch));
    if (hits.length === 0) return [];
    const unique = [...new Set(hits)].slice(0, 5).join(' ');
    return [{
      id: `no-emoji:${hits.length}`,
      description: `${hits.length} emoji/unicode-pictograph found (${unique}) — Example Brand uses zero emoji; only the → (U+2192) glyph is allowed.`,
      outcome: 'warning' as const,
    }];
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
