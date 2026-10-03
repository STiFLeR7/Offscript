/**
 * P53 — Workflow model, dependency graph, validator, serializer (pure mechanics).
 *
 * These are the graph/algorithm units the planner composes: deterministic topological ordering,
 * cycle-safe behavior, critical-path, parallel layers, structural validation, and a stable
 * serialize/deserialize round-trip (replay).
 */
import { describe, it, expect } from 'vitest';
import {
  buildGraph,
  topoOrder,
  criticalPath,
  parallelLayers,
  analyzeWorkflow,
  assembleWorkflow,
  validateWorkflow,
  serializeWorkflow,
  deserializeWorkflow,
  type WorkflowTask,
} from '../../src/project/workflow.js';

/** Minimal task factory — status defaults to 'ready', deps/priority overridable. */
function task(id: string, dependsOn: string[] = [], extra: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id,
    title: id,
    objective: `do ${id}`,
    inputs: [],
    outputs: [id],
    dependsOn,
    priority: 10,
    owner: 'x',
    status: 'ready',
    ...extra,
  };
}

describe('P53 dependency graph', () => {
  it('buildGraph records nodes and dependency edges', () => {
    const g = buildGraph([task('a'), task('b', ['a'])]);
    expect(g.nodes.sort()).toEqual(['a', 'b']);
    expect(g.edges.b).toEqual(['a']);
    expect(g.edges.a).toEqual([]);
  });

  it('topoOrder emits every task after its dependencies', () => {
    const tasks = [task('c', ['a', 'b']), task('b', ['a']), task('a')];
    const order = topoOrder(tasks);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('topoOrder breaks ties deterministically by priority then id', () => {
    const tasks = [
      task('a', [], { priority: 5 }),
      task('b', [], { priority: 1 }),
      task('c', [], { priority: 1 }),
    ];
    // b and c share priority 1 (lower first), tie-break by id → b,c; then a.
    expect(topoOrder(tasks)).toEqual(['b', 'c', 'a']);
  });

  it('topoOrder is cycle-safe — never throws, returns all ids', () => {
    const tasks = [task('a', ['b']), task('b', ['a'])];
    const order = topoOrder(tasks);
    expect(order.slice().sort()).toEqual(['a', 'b']);
  });

  it('criticalPath returns the longest dependency chain', () => {
    const tasks = [task('a'), task('b', ['a']), task('c', ['b']), task('d')];
    expect(criticalPath(tasks)).toEqual(['a', 'b', 'c']);
  });

  it('parallelLayers groups tasks that can run concurrently', () => {
    const tasks = [task('a'), task('b'), task('c', ['a', 'b'])];
    expect(parallelLayers(tasks)).toEqual([['a', 'b'], ['c']]);
  });
});

describe('P53 analysis', () => {
  it('buckets tasks by stamped status and finds independent nodes', () => {
    const tasks = [
      task('a', [], { status: 'complete' }),
      task('b', ['a'], { status: 'ready' }),
      task('c', ['b'], { status: 'blocked' }),
      task('iso', [], { status: 'ready' }),
    ];
    const a = analyzeWorkflow(tasks);
    expect(a.completed).toEqual(['a']);
    expect(a.ready).toContain('b');
    expect(a.blocked).toEqual(['c']);
    expect(a.independent).toEqual(['iso']); // no deps, no dependents
  });
});

describe('P53 validator', () => {
  const plan = (tasks: WorkflowTask[]) => assembleWorkflow({ projectType: 't', deliverables: ['website'], version: 0 }, tasks);

  it('accepts a well-formed workflow', () => {
    expect(validateWorkflow(plan([task('a'), task('b', ['a'])])).valid).toBe(true);
  });

  it('rejects a dangling dependency', () => {
    const r = validateWorkflow(plan([task('b', ['missing'])]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/missing/);
  });

  it('rejects a duplicate task id', () => {
    const r = validateWorkflow(plan([task('a'), task('a')]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('rejects a dependency cycle', () => {
    const r = validateWorkflow(plan([task('a', ['b']), task('b', ['a'])]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/cycle/i);
  });
});

describe('P53 serializer (replay)', () => {
  const p = assembleWorkflow({ projectType: 'website', deliverables: ['website'], version: 2 }, [task('a'), task('b', ['a'])]);

  it('round-trips deterministically', () => {
    const s = serializeWorkflow(p);
    expect(serializeWorkflow(p)).toBe(s); // stable
    expect(deserializeWorkflow(s)).toEqual(p); // reconstructs the exact plan
  });

  it('carries a schemaVersion and rejects an unknown one', () => {
    expect(JSON.parse(serializeWorkflow(p)).schemaVersion).toBe(1);
    expect(() => deserializeWorkflow(JSON.stringify({ schemaVersion: 9 }))).toThrow(/schemaVersion/);
  });
});
