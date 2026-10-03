import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type DeliverableType = 'website' | 'deck' | 'collateral';

export interface Deliverable {
  type: DeliverableType;
  name: string;
  sourceHtml: string;
  rulebookMd: string;
}

export interface Bundle {
  dir: string;
  tokensJson: string;
  deliverables: Deliverable[];
}

const KNOWN_TYPES: DeliverableType[] = ['website', 'deck', 'collateral'];

/** Read and validate a canonical bundle (spec §5.5). Throws with a specific reason on failure. */
export function loadBundle(dir: string): Bundle {
  const tokensPath = join(dir, 'brand-kit', 'tokens.json');
  if (!existsSync(tokensPath)) {
    throw new Error(`Invalid bundle: missing brand-kit/tokens.json in ${dir}`);
  }
  const tokensJson = readFileSync(tokensPath, 'utf8');

  const deliverablesDir = join(dir, 'deliverables');
  if (!existsSync(deliverablesDir)) {
    throw new Error(`Invalid bundle: missing deliverables/ directory in ${dir}`);
  }

  const deliverables: Deliverable[] = [];
  for (const name of readdirSync(deliverablesDir)) {
    const dPath = join(deliverablesDir, name);
    if (!statSync(dPath).isDirectory()) continue;
    if (!KNOWN_TYPES.includes(name as DeliverableType)) continue;

    const htmlPath = join(dPath, 'source', 'index.html');
    if (!existsSync(htmlPath)) {
      throw new Error(`Invalid deliverable '${name}': missing source/index.html`);
    }
    const rulebookPath = join(dPath, 'rulebook.md');
    deliverables.push({
      type: name as DeliverableType,
      name,
      sourceHtml: readFileSync(htmlPath, 'utf8'),
      rulebookMd: existsSync(rulebookPath) ? readFileSync(rulebookPath, 'utf8') : '',
    });
  }

  if (deliverables.length === 0) {
    throw new Error(`Invalid bundle: no recognized deliverables in ${dir}`);
  }
  return { dir, tokensJson, deliverables };
}
