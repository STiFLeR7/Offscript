/**
 * P53 — Creative Workflow model + dependency-graph mechanics.
 *
 * A Workflow Plan is a PLANNING ARTIFACT: an explicit, dependency-ordered set of the creative tasks a
 * project needs before/around generation. It is NOT an execution engine — nothing here runs a task,
 * invokes an agent, or calls an LLM. This module owns the pure mechanics (the model types, the
 * DependencyGraph, topological ordering, critical path, parallel layers, structural validation, and a
 * deterministic serialize/deserialize for replay). Task discovery lives in workflow-policy.ts; plan
 * assembly (completion + status from the Living Project Context) lives in workflow-planner.ts.
 *
 * Pure data — no clock/rng/fs. It belongs entirely to the Project Platform; generation is downstream
 * and never imports it.
 */
import type { Track } from '../paths.js';

/** A task is complete (satisfied by context), ready (all deps complete), or blocked (a dep is open). */
export type TaskStatus = 'complete' | 'ready' | 'blocked';

/** The atomic unit of the workflow — a logical piece of creative work with explicit dependencies. */
export interface WorkflowTask {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly inputs: string[];
  readonly outputs: string[];
  readonly dependsOn: string[];
  /** Ordering weight (lower first); the deterministic tie-break within a topological tier. */
  readonly priority: number;
  /** The logical capability that owns the task (e.g. 'website-author'). Not a runtime binding. */
  readonly owner: string;
  readonly status: TaskStatus;
}

/** The planning analysis over a task set — what a future execution engine reads to pick work. */
export interface WorkflowAnalysis {
  /** Topological task-id order (deps before dependents). */
  readonly order: string[];
  /** The longest dependency chain (root → leaf). */
  readonly criticalPath: string[];
  readonly ready: string[];
  readonly blocked: string[];
  readonly completed: string[];
  /** Tasks with no dependencies AND no dependents. */
  readonly independent: string[];
  /** Concurrency layers — each inner array can run in parallel once earlier layers are done. */
  readonly parallel: string[][];
}

export interface WorkflowPlan {
  readonly schemaVersion: 1;
  readonly projectType: string;
  readonly deliverables: Track[];
  /** The Living Project Context version this plan reflects (0 when planned without context). */
  readonly version: number;
  /** Tasks in topological order. */
  readonly tasks: WorkflowTask[];
  readonly analysis: WorkflowAnalysis;
}

/** id → its dependency ids. A plain adjacency map — the explicit dependency representation. */
export interface DependencyGraph {
  readonly nodes: string[];
  readonly edges: Record<string, string[]>;
}

interface HasDeps {
  readonly id: string;
  readonly dependsOn: string[];
}
interface Orderable extends HasDeps {
  readonly priority: number;
}

export function buildGraph(tasks: readonly HasDeps[]): DependencyGraph {
  const nodes = tasks.map((t) => t.id);
  const present = new Set(nodes);
  const edges: Record<string, string[]> = {};
  for (const t of tasks) edges[t.id] = t.dependsOn.filter((d) => present.has(d));
  return { nodes, edges };
}

/**
 * Kahn-style topological order with a deterministic (priority, id) tie-break. A dependency on an id
 * that is not itself a task is treated as satisfied (external input). Cycle-safe: if no node is fully
 * unblocked it falls back to the lowest (priority, id) remaining node, so it always returns every id.
 */
export function topoOrder(tasks: readonly Orderable[]): string[] {
  const inSet = new Set(tasks.map((t) => t.id));
  const emitted = new Set<string>();
  const pending = [...tasks];
  const out: string[] = [];
  const rank = (a: Orderable, b: Orderable) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  while (pending.length) {
    const ready = pending.filter((t) => t.dependsOn.every((d) => emitted.has(d) || !inSet.has(d)));
    const pool = (ready.length ? ready : pending).slice().sort(rank);
    const next = pool[0]; // cycle-safe: falls back to lowest (priority,id) pending
    out.push(next.id);
    emitted.add(next.id);
    pending.splice(pending.indexOf(next), 1);
  }
  return out;
}

/** The longest dependency chain (by node count; ties broken by lower summed priority then id order). */
export function criticalPath(tasks: readonly Orderable[]): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, string[]>();
  const better = (a: string[], b: string[]): string[] => {
    if (a.length !== b.length) return a.length > b.length ? a : b;
    const sum = (ids: string[]) => ids.reduce((n, id) => n + (byId.get(id)?.priority ?? 0), 0);
    if (sum(a) !== sum(b)) return sum(a) < sum(b) ? a : b;
    return a.join() <= b.join() ? a : b;
  };
  // Longest chain ENDING at id (walking dependency edges backward), returned root → id.
  const chain = (id: string, seen: Set<string>): string[] => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return [id]; // cycle guard
    seen.add(id);
    const deps = (byId.get(id)?.dependsOn ?? []).filter((d) => byId.has(d));
    let best: string[] = [];
    for (const d of deps) best = better(best, chain(d, seen));
    seen.delete(id);
    const result = [...best, id];
    memo.set(id, result);
    return result;
  };
  let longest: string[] = [];
  for (const t of tasks) longest = better(longest, chain(t.id, new Set()));
  return longest;
}

/**
 * Concurrency layers — each layer is every not-yet-placed task whose deps are all in earlier layers.
 * Cycle-safe (a stuck remainder is emitted as one final layer). Ids within a layer sorted for stability.
 */
export function parallelLayers(tasks: readonly HasDeps[]): string[][] {
  const inSet = new Set(tasks.map((t) => t.id));
  const placed = new Set<string>();
  const pending = [...tasks];
  const layers: string[][] = [];
  while (pending.length) {
    const layer = pending.filter((t) => t.dependsOn.every((d) => placed.has(d) || !inSet.has(d)));
    const chosen = (layer.length ? layer : pending).map((t) => t.id).sort();
    layers.push(chosen);
    for (const id of chosen) {
      placed.add(id);
      pending.splice(pending.findIndex((t) => t.id === id), 1);
    }
  }
  return layers;
}

/** Bucket a stamped task set by status and compute structural analysis. */
export function analyzeWorkflow(tasks: readonly WorkflowTask[]): WorkflowAnalysis {
  const order = topoOrder(tasks);
  const pos = (id: string) => order.indexOf(id);
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).map((t) => t.id).sort((a, b) => pos(a) - pos(b));
  const referenced = new Set(tasks.flatMap((t) => t.dependsOn));
  const independent = tasks.filter((t) => t.dependsOn.length === 0 && !referenced.has(t.id)).map((t) => t.id).sort();
  return {
    order,
    criticalPath: criticalPath(tasks),
    ready: byStatus('ready'),
    blocked: byStatus('blocked'),
    completed: byStatus('complete'),
    independent,
    parallel: parallelLayers(tasks),
  };
}

/** Assemble a plan: sort tasks into topological order and attach the analysis. */
export function assembleWorkflow(
  meta: { projectType: string; deliverables: Track[]; version: number },
  tasks: readonly WorkflowTask[],
): WorkflowPlan {
  const order = topoOrder(tasks);
  const sorted = [...tasks].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return {
    schemaVersion: 1,
    projectType: meta.projectType,
    deliverables: [...meta.deliverables],
    version: meta.version,
    tasks: sorted,
    analysis: analyzeWorkflow(sorted),
  };
}

/** Structural integrity: unique ids, no dangling dependency, no dependency cycle. */
export function validateWorkflow(plan: WorkflowPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = plan.tasks.map((t) => t.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate task id "${id}".`);
    seen.add(id);
  }
  for (const t of plan.tasks) {
    for (const d of t.dependsOn) {
      if (!seen.has(d)) errors.push(`task "${t.id}" depends on missing task "${d}".`);
    }
  }
  for (const id of detectCycle(plan.tasks)) errors.push(`dependency cycle through "${id}".`);
  return { valid: errors.length === 0, errors };
}

/** Return the ids on a dependency cycle (empty if the graph is acyclic). */
function detectCycle(tasks: readonly HasDeps[]): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map<string, 0 | 1 | 2>(); // 0=unseen 1=on-stack 2=done
  const onCycle: string[] = [];
  const visit = (id: string): boolean => {
    if (!byId.has(id)) return false;
    const s = state.get(id) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const d of byId.get(id)!.dependsOn) {
      if (visit(d)) {
        onCycle.push(id);
        state.set(id, 2);
        return true;
      }
    }
    state.set(id, 2);
    return false;
  };
  for (const t of tasks) visit(t.id);
  return onCycle;
}

// ── Serialization (deterministic replay artifact) ───────────────────────────────

const TASK_KEYS: (keyof WorkflowTask)[] = ['id', 'title', 'objective', 'inputs', 'outputs', 'dependsOn', 'priority', 'owner', 'status'];

function orderTask(t: WorkflowTask): WorkflowTask {
  const o = {} as Record<string, unknown>;
  for (const k of TASK_KEYS) o[k] = t[k];
  return o as unknown as WorkflowTask;
}

/** Serialize with a fixed key order so the artifact is stable and diffable. */
export function serializeWorkflow(plan: WorkflowPlan): string {
  const canonical: WorkflowPlan = {
    schemaVersion: 1,
    projectType: plan.projectType,
    deliverables: plan.deliverables,
    version: plan.version,
    tasks: plan.tasks.map(orderTask),
    analysis: plan.analysis,
  };
  return JSON.stringify(canonical, null, 2);
}

export function deserializeWorkflow(text: string): WorkflowPlan {
  const obj = JSON.parse(text) as WorkflowPlan;
  if (obj.schemaVersion !== 1) throw new Error(`workflow: unsupported schemaVersion ${String(obj.schemaVersion)}.`);
  return obj;
}
