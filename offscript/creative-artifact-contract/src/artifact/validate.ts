/**
 * CreativeArtifactValidator — structural + semantic (JSON Schema via ajv,
 * against schema/creative-artifact.schema.json — the single source of truth
 * for required fields and closed enums) plus location portability (the one
 * precondition the schema deliberately does not express — see location.ts).
 * Never fixes, never guesses, only reports.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { ErrorObject } from 'ajv';
import { describeLocationRejection } from './location.js';

// ajv ships as CJS (`module.exports = Ajv`) — require it directly under NodeNext,
// same pattern as creative-intent-exporter/src/intent/validate.ts.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv: any = require('ajv');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', '..', 'schema', 'creative-artifact.schema.json');

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function loadSchema(): object {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

function describeSchemaError(err: ErrorObject): string {
  const path = err.instancePath || '(root)';
  return `${path} ${err.message ?? 'is invalid'}`.trim();
}

export class CreativeArtifactValidator {
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

  validate(wire: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Structural + semantic (JSON Schema — required fields, types, closed enums)
    const structurallyValid = this.validateSchema(wire);
    if (!structurallyValid) {
      for (const err of this.validateSchema.errors ?? []) {
        errors.push(describeSchemaError(err));
      }
    }

    // Unknown top-level keys: warn, never fail (forward-compatibility)
    if (wire && typeof wire === 'object') {
      for (const key of Object.keys(wire as Record<string, unknown>)) {
        if (!this.knownKeys.has(key)) {
          warnings.push(`unrecognized field "${key}" — ignored, not validated, forward-compatible`);
        }
      }
    }

    // 2. Location portability — deliberately not expressible as a single schema pattern
    const location = (wire as Record<string, unknown> | null)?.location;
    if (typeof location === 'string') {
      const rejection = describeLocationRejection(location);
      if (rejection) errors.push(`location: ${rejection}`);
    }

    return { ok: errors.length === 0, errors, warnings };
  }
}
