import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** A Claude Design website kit: a runtime React+Babel harness plus token CSS. */
export interface WebsiteKit {
  // harnessHtml/tokensCss are read eagerly; components stay as paths (read lazily downstream).
  dir: string;
  harnessHtml: string;
  tokensCss: string;
  componentFiles: string[];
  assetsDir: string | null;
  fontsDir: string | null;
  /**
   * Verbatim contents of `<kitDir>/creative-direction.md` if present.
   * Per-project steering loaded at intake and embedded into the actuator
   * instruction by `src/instruction.ts` (composeInstruction). Optional — kits
   * without this file leave the field undefined and the composer omits the
   * section. Schema: docs/superpowers/plans/2026-05-28-offscript-creative-direction-schema.md.
   */
  creativeDirection?: string;
}

/** For v1 the only kit `<type>` is `website`. */
const KIT_TYPE = 'website';

/**
 * Recognize the canonical Claude Design website-kit folder shape and return a
 * typed descriptor. A website kit is a directory containing BOTH
 * `ui_kits/<type>/index.html` (the React+Babel harness) AND
 * `colors_and_type.css` (the token CSS). Throws with a specific reason when a
 * required piece is missing.
 */
export function detectKitLayout(dir: string): WebsiteKit {
  const tokensPath = join(dir, 'colors_and_type.css');
  if (!existsSync(tokensPath)) {
    throw new Error(`Invalid kit: missing colors_and_type.css in ${dir}`);
  }
  const tokensCss = readFileSync(tokensPath, 'utf8');

  const kitDir = join(dir, 'ui_kits', KIT_TYPE);
  const harnessPath = join(kitDir, 'index.html');
  if (!existsSync(harnessPath)) {
    throw new Error(`Invalid kit: missing ui_kits/${KIT_TYPE}/index.html in ${dir}`);
  }
  const harnessHtml = readFileSync(harnessPath, 'utf8');

  const componentFiles = readdirSync(kitDir)
    .filter((name) => name.endsWith('.jsx') && statSync(join(kitDir, name)).isFile())
    .sort()
    .map((name) => join(kitDir, name));
  if (componentFiles.length === 0) {
    throw new Error(`Invalid kit: no *.jsx component in ui_kits/${KIT_TYPE}/ in ${dir}`);
  }

  const assetsPath = join(dir, 'assets');
  const fontsPath = join(dir, 'fonts');

  const creativeDirectionPath = join(dir, 'creative-direction.md');
  const creativeDirection = existsSync(creativeDirectionPath)
    ? readFileSync(creativeDirectionPath, 'utf8')
    : undefined;

  return {
    dir,
    harnessHtml,
    tokensCss,
    componentFiles,
    assetsDir: existsSync(assetsPath) ? assetsPath : null,
    fontsDir: existsSync(fontsPath) ? fontsPath : null,
    creativeDirection,
  };
}
