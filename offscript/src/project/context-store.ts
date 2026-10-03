/**
 * P52 — Context Store: persistence of the Living Project Context.
 *
 * The context is stored as an APPEND-ONLY session log at projects/<client>/context.json — the log
 * is the source of truth; the rich context view is reconstructed from it on read. Writing a session
 * appends and re-serializes deterministically (stable key order, no clock), so the store is
 * diffable and replayable. Generation never touches this file; it is Project-Platform state only.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir } from '../paths.js';
import { parseBrief } from '../generate/brief.js';
import { readProjectManifest } from './workspace.js';
import { newSession, applySession, reconstructContext, buildBriefSession } from './context-updater.js';
import { emptyContext, type ProjectContext, type ProjectIdentity, type ProjectSession, type SessionInput } from './project-context.js';

/** Path to a project's living-context log. */
export function projectContextPath(client: string): string {
  return join(projectDir(client), 'context.json');
}

interface StoredContext {
  readonly schemaVersion: 1;
  readonly client: string;
  readonly projectType: string;
  readonly deliverables: ProjectIdentity['deliverables'];
  readonly sessions: ProjectSession[];
}

function readStored(client: string): StoredContext | null {
  const p = projectContextPath(client);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as StoredContext;
}

function identityFromManifest(client: string): ProjectIdentity {
  const m = readProjectManifest(client); // fail-loud if the project was never initialized
  return { client: m.client, projectType: m.projectType, deliverables: [...m.deliverables] };
}

function identityOf(stored: StoredContext): ProjectIdentity {
  return { client: stored.client, projectType: stored.projectType, deliverables: [...stored.deliverables] };
}

/** Load (reconstruct) the current context. Absent log ⇒ empty context from the project manifest. */
export function loadProjectContext(client: string): ProjectContext {
  const stored = readStored(client);
  if (!stored) return emptyContext(identityFromManifest(client));
  return reconstructContext(identityOf(stored), stored.sessions);
}

/** Deterministic serialization of the append-only log (fixed key order, 2-space indent). */
function serialize(identity: ProjectIdentity, sessions: ProjectSession[]): string {
  const stored: StoredContext = {
    schemaVersion: 1,
    client: identity.client,
    projectType: identity.projectType,
    deliverables: identity.deliverables,
    sessions,
  };
  return JSON.stringify(stored, null, 2) + '\n';
}

/** Author + persist one session; returns the new context. Append-only — prior sessions are kept. */
export function recordProjectSession(client: string, input: SessionInput, now: string): ProjectContext {
  const ctx = loadProjectContext(client);
  const session = newSession(input, ctx, now);
  writeFileSync(projectContextPath(client), serialize(ctx.identity, [...ctx.sessions, session]), 'utf8');
  return applySession(ctx, session);
}

/**
 * Record a completed acquisition into the context: diff the acquired brief against the prior context
 * to author confirmed/changed fact decisions, then persist a session. This is the "every completed
 * Creative Director session updates Project Context" hook — invoked by orchestration (the CLI), never
 * by the generation pipeline.
 */
export function recordAcquisition(opts: {
  client: string;
  briefText: string;
  answers?: Record<string, unknown>;
  goal?: string;
  now: string;
  artifacts?: readonly string[];
}): { context: ProjectContext; session: ProjectSession } {
  const prior = loadProjectContext(opts.client);
  const brief = parseBrief(opts.briefText);
  const input = buildBriefSession({ prior, brief, answers: opts.answers, goal: opts.goal, artifacts: opts.artifacts });
  const context = recordProjectSession(opts.client, input, opts.now);
  return { context, session: context.sessions[context.sessions.length - 1] };
}
