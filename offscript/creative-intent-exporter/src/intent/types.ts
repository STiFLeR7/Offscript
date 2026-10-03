/** Mirrors CG7 §4/§9 exactly — no field, type, or enum beyond the frozen schema. */

export type Feature =
  | 'automation'
  | 'search'
  | 'analytics'
  | 'security'
  | 'collaboration'
  | 'ai-intelligence'
  | 'configuration';

export type Camera = 'establishing' | 'product' | 'workflow' | 'component' | 'macro';

export type Ratio = '1:1' | '4:3' | '3:4' | '16:9';

export type ContentProvenance = 'human' | 'augmented';

export type Section = 'hero' | 'feature' | 'benefit' | 'cta' | 'social' | 'collateral';

/** The payload — creative content, exactly CG6 §3's Public field set. */
export interface CreativeIntentPayload {
  id: string;
  belief: string;
  feature: Feature | string;
  ratio: Ratio | string;
  camera: Camera | string;
  mustInclude: string[];
  contentProvenance: ContentProvenance | string;
  section?: Section | string;
}

/** The full envelope + payload, as written to a creative-intent.json instance. */
export interface CreativeIntent extends CreativeIntentPayload {
  contractVersion: 1;
  digest: string;
  provenance?: Record<string, string | number | boolean>;
}

/** Wire shape — kebab-case keys, matching creative-intent.schema.json property names verbatim. */
export interface CreativeIntentWire {
  id: string;
  contractVersion: 1;
  digest: string;
  provenance?: Record<string, string | number | boolean>;
  belief: string;
  feature: string;
  ratio: string;
  camera: string;
  'must-include': string[];
  'content-provenance': string;
  section?: string;
}

export function toWire(intent: CreativeIntent): CreativeIntentWire {
  const wire: CreativeIntentWire = {
    id: intent.id,
    contractVersion: intent.contractVersion,
    digest: intent.digest,
    belief: intent.belief,
    feature: intent.feature,
    ratio: intent.ratio,
    camera: intent.camera,
    'must-include': intent.mustInclude,
    'content-provenance': intent.contentProvenance,
  };
  if (intent.section !== undefined) wire.section = intent.section;
  if (intent.provenance !== undefined) wire.provenance = intent.provenance;
  return wire;
}
