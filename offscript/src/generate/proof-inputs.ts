import { normalizeBrief } from '../project/brief-normalizer.js';

/** Fictional development input, not an approved customer identity. */
export interface ProofInput {
  brand:string; oneLiner:string; audience:string; tone:string; body:string;
  accent:string; fontFamily:string; track:'website'|'collateral';
}

export function proofFiles(input:ProofInput):Record<string,string> {
  for (const key of ['brand','oneLiner','audience','tone','body','fontFamily'] as const) {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`proof input: ${key} is required`);
  }
  if (input.track !== 'website' && input.track !== 'collateral') throw new Error('proof input: unsupported track');
  if (typeof input.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.accent)) throw new Error('proof input: accent must be six-digit hex');
  if (!/^[a-z][a-z0-9 _-]*$/i.test(input.fontFamily)) throw new Error('proof input: unsafe font family');
  const generic=new Set(['serif','sans-serif','monospace','system-ui','cursive','fantasy']);
  const family=generic.has(input.fontFamily)?input.fontFamily:JSON.stringify(input.fontFamily);
  const escaped=input.brand.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  const mark=(fill:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 72" role="img"><title>${escaped}</title><text x="0" y="48" fill="${fill}" font-family="${input.fontFamily}" font-size="40">${escaped}</text></svg>\n`;
  return {
    'brief.md':normalizeBrief({track:input.track,brand:input.brand,oneLiner:input.oneLiner,
      audience:input.audience,tone:input.tone,body:input.body,
      provenance:{source:'synthetic-authoring-proof'}}),
    'colors_and_type.css':`:root {
  --cr-brand: ${input.accent};
  --cr-accent: ${input.accent};
  --cr-ink: #19211d;
  --cr-paper: #faf8f2;
  --cr-surface: #ffffff;
  --cr-muted: #626b65;
  --cr-line: #d7ddd5;
  --cr-white: #ffffff;
  --cr-font-body: ${family}, system-ui, sans-serif;
  --cr-font-display: ${family}, system-ui, sans-serif;
  --cr-space-1: 4px;
  --cr-space-2: 8px;
  --cr-space-3: 16px;
  --cr-space-4: 24px;
  --cr-space-5: 40px;
  --cr-space-6: 64px;
}
* { box-sizing: border-box; }
body { margin: 0; color: var(--cr-ink); background: var(--cr-paper); font-family: var(--cr-font-body); line-height: 1.5; }
a { color: inherit; }
img, svg { max-width: 100%; }
\n`,
    'voice.md':`${input.brand}\n\nTone: ${input.tone}\nAudience: ${input.audience}\nPreserve supplied facts. Do not invent statistics, customer quotes or commercial claims.\n`,
    'logo-light.svg':mark(input.accent),
    'logo-dark.svg':mark('#ffffff'),
    'brand-kit.json':JSON.stringify({schemaVersion:1,subject:input.brand,
      logo:{lightSurfaceMark:'logo-light.svg',darkSurfaceMark:'logo-dark.svg'},voiceReference:'voice.md'},null,2)+'\n',
  };
}
