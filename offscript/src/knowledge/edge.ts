/**
 * PKG — Repository Builder: the derived graph edge.
 *
 * An edge is a faithful projection of one authored declaration. It is data, never
 * code: source and target are identities/terms, kind names the declared relation.
 * Reverse edges and closures are NOT stored — they are derivable (kept out of the
 * authored + materialized truth, per the derived-not-authored boundary).
 */
export interface Edge {
  readonly source: string;
  readonly kind: string;
  readonly target: string;
}

export function compareEdge(a: Edge, b: Edge): number {
  return (
    a.source.localeCompare(b.source) ||
    a.kind.localeCompare(b.kind) ||
    a.target.localeCompare(b.target)
  );
}
