import type { Root } from 'hast';
import { resolveAnchor } from '../sections.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

/** The native HTML element that natively provides each ARIA landmark role. */
const NATIVE_ELEMENT: Record<string, string> = {
  banner: 'header',
  navigation: 'nav',
  main: 'main',
  complementary: 'aside',
  contentinfo: 'footer',
};

/**
 * The core pass, shared by detect (mutate=false) and apply (mutate=true).
 * §8.1 single shape; Tier-1 — anchored on the declared sections map, never nth-child.
 */
function run(tree: Root, ctx: OperatorContext, mutate: boolean): Finding[] {
  const sections = ctx.sections;
  if (!sections) return [];
  const findings: Finding[] = [];

  for (const section of sections.sections) {
    if (!section.landmark) continue; // not a landmark region — carried in the map, ignored here
    const role = section.landmark;
    const el = resolveAnchor(tree, section);

    // declared anchor no longer resolves — structural drift → frozen re-decide (no mutation)
    if (!el) {
      findings.push({
        id: `landmark-semantics:${section.id}`,
        description: `declared section "${section.id}" (anchor #${section.anchor}) was not found; landmark "${role}" cannot be applied`,
        outcome: 'escalated',
      });
      continue;
    }

    // already satisfied: explicit role, or the native element for this landmark
    const satisfied = el.properties?.role === role || el.tagName === NATIVE_ELEMENT[role];
    if (satisfied) continue;

    findings.push({
      id: `landmark-semantics:${section.id}`,
      description: `section "${section.id}" should carry the ${role} landmark`,
      outcome: 'auto-remediated',
    });
    if (mutate) {
      el.properties = el.properties ?? {};
      el.properties.role = role;
    }
  }

  return findings;
}

/** Tier-1 sections-anchored transform: apply the declared ARIA landmark to each region (spec §8.1, §8.4 #3). */
export const landmarkSemantics: Operator = {
  name: 'landmark-semantics',
  tier: 1,
  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, false);
  },
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return run(tree, ctx, true);
  },
};
