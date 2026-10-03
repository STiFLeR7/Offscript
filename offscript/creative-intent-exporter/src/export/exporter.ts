/**
 * CreativeIntentExporter — composes the existing stages (parser, builder,
 * digest, validator, serializer) into the end-to-end export pipeline.
 * Never re-derives belief/feature/camera/must-include/content-provenance —
 * every one of those is read verbatim off Output/_LOG.md, which is the
 * only place Repo B's Creative Intelligence Layer already persisted them.
 *
 * Contract: exports one creative-intent.json instance per eligible
 * (approved=yes AND v5+-complete) source line. Never exports a rejected
 * creative, a draft, or a pre-contract (pre-v5) creative — those are
 * reported as "skipped" diagnostics, never silently dropped and never
 * thrown as errors (a pre-v5 approved creative is not a bug, it is simply
 * out of this contract's scope, per CG7 §2).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLogLines } from '../log/reader.js';
import { parseLogLine } from '../log/parser.js';
import { buildCreativeIntentPayload } from '../intent/build.js';
import { computeDigest } from '../intent/digest.js';
import { CreativeIntentValidator } from '../intent/validate.js';
import { serializeCreativeIntent } from '../intent/serialize.js';
import { toWire, type CreativeIntent } from '../intent/types.js';

export interface ExportOptions {
  logPath: string;
  outDir: string;
}

export interface ExportDiagnostic {
  slug: string;
  status: 'exported' | 'skipped' | 'failed';
  reason?: string;
  path?: string;
}

export interface ExportSummary {
  diagnostics: ExportDiagnostic[];
  exportedCount: number;
  skippedCount: number;
  failedCount: number;
}

export class CreativeIntentExporter {
  constructor(private readonly validator: CreativeIntentValidator = new CreativeIntentValidator()) {}

  async export(options: ExportOptions): Promise<ExportSummary> {
    mkdirSync(options.outDir, { recursive: true });

    const diagnostics: ExportDiagnostic[] = [];
    const rawLines = readLogLines(options.logPath);

    for (const rawLine of rawLines) {
      let slug = '(unparsed)';
      try {
        const record = parseLogLine(rawLine);
        slug = record.slug;

        const built = buildCreativeIntentPayload(record);
        if (!built.ok) {
          diagnostics.push({ slug, status: 'skipped', reason: built.reason });
          continue;
        }

        const digest = computeDigest({
          contractVersion: 1,
          id: built.payload.id,
          belief: built.payload.belief,
          feature: built.payload.feature,
          ratio: built.payload.ratio,
          camera: built.payload.camera,
          mustInclude: built.payload.mustInclude,
          contentProvenance: built.payload.contentProvenance,
          section: built.payload.section,
        });

        const intent: CreativeIntent = {
          contractVersion: 1,
          digest,
          ...built.payload,
        };
        const wire = toWire(intent);

        const sourceApproved = record.raw.get('approved') === 'yes';
        const result = this.validator.validate(wire, { sourceApproved });
        if (!result.ok) {
          diagnostics.push({ slug, status: 'failed', reason: result.errors.join('; ') });
          continue;
        }

        const path = join(options.outDir, `${slug}.creative-intent.json`);
        writeFileSync(path, serializeCreativeIntent(wire), 'utf8');
        diagnostics.push({ slug, status: 'exported', path });
      } catch (err) {
        diagnostics.push({
          slug,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      diagnostics,
      exportedCount: diagnostics.filter((d) => d.status === 'exported').length,
      skippedCount: diagnostics.filter((d) => d.status === 'skipped').length,
      failedCount: diagnostics.filter((d) => d.status === 'failed').length,
    };
  }
}
