import { describe, it, expect } from 'vitest';
import { parseRecipe } from '../src/recipe.js';

describe('parseRecipe', () => {
  it('parses operators from the yaml block in a rulebook', () => {
    const md = [
      '# Rulebook',
      '',
      '```yaml',
      'operators:',
      '  - operator: lang-attr',
      '    params:',
      '      lang: en',
      '```',
    ].join('\n');
    const recipe = parseRecipe(md);
    expect(recipe.operators).toEqual([{ operator: 'lang-attr', params: { lang: 'en' } }]);
  });

  it('defaults params to an empty object when omitted', () => {
    const md = ['```yaml', 'operators:', '  - operator: lang-attr', '```'].join('\n');
    expect(parseRecipe(md).operators).toEqual([{ operator: 'lang-attr', params: {} }]);
  });

  it('returns an empty recipe when no yaml block is present', () => {
    expect(parseRecipe('# Rulebook\n\nnothing here')).toEqual({ operators: [] });
  });
});
