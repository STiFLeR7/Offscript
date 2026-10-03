/**
 * CreativeIntentValidator — the last gate before a Creative Intent instance
 * is written. Runs, in order (CG7 §6): structural+semantic (JSON Schema,
 * via ajv against schema/creative-intent.schema.json — the single source of
 * truth for enums, never duplicated here), digest (recompute and compare),
 * trust (the source line was approved=yes). Never fixes, never guesses,
 * never emits on a failure — it only reports.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { ErrorObject } from 'ajv';
import { computeDigest } from './digest.js';
import type { CreativeIntentWire } from './types.js';

// ajv ships as CJS (`module.exports = Ajv`). Under NodeNext the ESM default import
// resolves to the (non-constructable) module namespace, so require it directly to
// get the class — same pattern as packet-brief-adapter/src/brief/schema.ts.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv: any = require('ajv');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', '..', 'schema', 'creative-intent.schema.json');

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationContext {
  /** Whether the source _LOG.md line read approved=yes at export time. */
  sourceApproved: boolean;
}

function loadSchema(): object {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

function describeSchemaError(err: ErrorObject): string {
  const path = err.instancePath || '(root)';
  return `${path} ${err.message ?? 'is invalid'}`.trim();
}

export class CreativeIntentValidator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly ajv: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly validateSchema: any;
  private readonly knownKeys: Set<string>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    const schema = loadSchema() as { properties?: Record<string, unknown> };
    this.validateSchema = this.ajv.compile(schema);
    this.knownKeys = new Set(Object.keys(schema.properties ?? {}));
  }

  validate(wire: CreativeIntentWire, ctx: ValidationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Structural + semantic (JSON Schema — required fields, types, enums)
    const structurallyValid = this.validateSchema(wire);
    if (!structurallyValid) {
      for (const err of this.validateSchema.errors ?? []) {
        errors.push(describeSchemaError(err));
      }
    }

    // Unknown top-level keys: warn, never fail (forward-compatibility, CG7 §7/§8)
    for (const key of Object.keys(wire)) {
      if (!this.knownKeys.has(key)) {
        warnings.push(`unrecognized field "${key}" — ignored, not validated, forward-compatible`);
      }
    }

    // 2. Digest — only meaningful once structurally sound enough to recompute from
    if (structurallyValid) {
      const recomputed = computeDigest({
        contractVersion: wire.contractVersion,
        id: wire.id,
        belief: wire.belief,
        feature: wire.feature,
        ratio: wire.ratio,
        camera: wire.camera,
        mustInclude: wire['must-include'],
        contentProvenance: wire['content-provenance'],
        section: wire.section,
      });
      if (recomputed !== wire.digest) {
        errors.push(
          `digest mismatch: stored "${wire.digest}" does not match recomputed "${recomputed}" — ` +
            `the payload was altered after the digest was computed, or the digest is simply wrong`
        );
      }
    }

    // 3. Trust — the one precondition no schema can express
    if (!ctx.sourceApproved) {
      errors.push(
        `trust precondition failed: source creative "${wire.id}" was not approved=yes at export time`
      );
    }

    return { ok: errors.length === 0, errors, warnings };
  }
}
