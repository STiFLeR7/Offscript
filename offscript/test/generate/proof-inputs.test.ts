import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { proofFiles, type ProofInput } from '../../src/generate/proof-inputs.js';
import { parseBrief } from '../../src/generate/brief.js';
import { parseBrandKit } from '../../src/brand-kit.js';
import { loadTokensFromCss } from '../../src/tokens.js';

const northline: ProofInput = {brand:'Northline',oneLiner:'Organize field notes',audience:'Researchers',
  tone:'quiet and precise',body:'## Hero\nOrganize field notes',accent:'#506342',fontFamily:'Georgia',track:'website'};

describe('independent authoring proof inputs',()=>{
  it.each([
    ['northline.json','Northline','#506342','Georgia','quiet and precise'],
    ['pixel-garden.json','Pixel Garden','#a840ed','monospace','bright and direct'],
  ])('round trips declared identity from %s',(file,brand,accent,font,tone)=>{
    const input=JSON.parse(readFileSync(resolve('..','examples','authoring-proof',file),'utf8')) as ProofInput;
    const files=proofFiles(input);
    const brief=parseBrief(files['brief.md']);
    expect(brief.brand).toBe(brand);
    expect(brief.body).toContain(input.body.trim());
    expect(brief.tone).toBe(tone);
    const tokens=loadTokensFromCss(files['colors_and_type.css']);
    expect(tokens.customProps.get('--cr-brand')).toBe(accent);
    expect(tokens.customProps.get('--cr-font-body')).toContain(font);
    expect(files['voice.md']).toContain(tone);
    const kit=parseBrandKit(files['brand-kit.json']);
    expect(kit.subject).toBe(brand);
    expect(kit.logo.lightSurfaceMark).toBe('logo-light.svg');
    expect(kit.logo.darkSurfaceMark).toBe('logo-dark.svg');
    expect(Object.values(files).join('\n')).not.toContain('Example Brand');
  });
  it('escapes original SVG text and keeps YAML-sensitive identity intact',()=>{
    const input={...northline,brand:'Field & <Notes>: Studio'};
    const files=proofFiles(input);
    expect(parseBrief(files['brief.md']).brand).toBe(input.brand);
    expect(files['logo-light.svg']).toContain('Field &amp; &lt;Notes&gt;: Studio');
    expect(files['logo-light.svg']).not.toContain('<Notes>');
  });
  it.each([
    {brand:''},{oneLiner:''},{accent:'red'},{accent:'#123'},{fontFamily:'Arial; background:url(https://example.com)'},
    {track:'deck'},
  ])('rejects invalid proof input %j',patch=>{
    expect(()=>proofFiles({...northline,...patch} as ProofInput)).toThrow();
  });
  it('does not mutate supplied inputs',()=>{
    const frozen=Object.freeze({...northline});
    proofFiles(frozen);
    expect(frozen).toEqual(northline);
  });
});
