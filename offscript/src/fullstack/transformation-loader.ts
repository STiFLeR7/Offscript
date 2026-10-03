/**
 * F2 — Transformation Loader: the single entry point into the Full-Stack Engine
 * (`docs/fullstack/F1-S1-FULLSTACK-TRANSFORMATION-ARCHITECTURE.md` §2, §11.1). Locates, loads,
 * deserializes, and validates a completed `rendering-ir.json` (C1) into a typed, immutable
 * `TransformationProject` — nothing more. It never calls Generation, never mutates the Rendering
 * IR, and performs no interpretation/transformation/framework work — that is every later
 * Program-F sprint's job, not this one's.
 *
 * Lives outside `src/generate/` on purpose, mirroring `src/runtime/`'s own isolation discipline
 * (`offscript-runtime.ts` header) — a structural signal that this plane is Generation-independent.
 *
 * Validation is entirely reused, not reimplemented: `validateRenderingIR` (`rendering-ir.ts`)
 * already checks version support and digest integrity — this module never duplicates either check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveWorkingDir, type Track } from '../paths.js';
import { validateRenderingIR, type RenderingIR } from '../generate/rendering-ir.js';

/** Where C1 writes (and this loader reads) the artifact — the one filename/location contract. */
export const RENDERING_IR_FILENAME = 'rendering-ir.json';

/** Pure — no I/O. `resolveWorkingDir` is the same function `scripts/generate.ts` resolves `outDir` with. */
export function resolveRenderingIRPath(client: string, track: Track): string {
  return join(resolveWorkingDir(client, track), RENDERING_IR_FILENAME);
}

/** The canonical loaded-project model. Frozen — every field is a read-only snapshot of what was
 *  on disk at load time; nothing about it changes, and nothing framework-specific is carried. */
export interface TransformationProject {
  readonly rir: RenderingIR;
  readonly client: string;
  readonly track: Track;
  readonly sourcePath: string;
}

/**
 * Load an explicit `rendering-ir.json` path into a `TransformationProject`. The lower-level of the
 * two entry points — takes `client`/`track` as plain labels (not used to resolve the path), so it
 * is testable against a fixture file without a real `projects/<client>/<track>/` directory.
 * Fails loud on every documented failure case: missing file, invalid JSON, unsupported version,
 * invalid/tampered digest (the last two via the reused validator, never a new check).
 */
export function loadTransformationProjectFromFile(path: string, client: string, track: Track): TransformationProject {
  if (!existsSync(path)) {
    throw new Error(`loadTransformationProjectFromFile: no rendering-ir.json found at ${path} — run \`/offscript generate ${client} --track ${track}\` first.`);
  }
  const raw = readFileSync(path, 'utf8');
  let rir: RenderingIR;
  try {
    rir = JSON.parse(raw) as RenderingIR;
  } catch (err) {
    throw new Error(`loadTransformationProjectFromFile: ${path} is not valid JSON — ${(err as Error).message}`);
  }
  const check = validateRenderingIR(rir);
  if (!check.valid) {
    throw new Error(`loadTransformationProjectFromFile: ${path} failed RenderingIR validation — ${check.errors.join('; ')}`);
  }
  return Object.freeze({ rir, client, track, sourcePath: path });
}

/** The real entry point: resolve the standard location for `(client, track)`, then load it. */
export function loadTransformationProject(client: string, track: Track): TransformationProject {
  return loadTransformationProjectFromFile(resolveRenderingIRPath(client, track), client, track);
}
