/**
 * Sprint X — Governed Model Derivation layer (Phase A). Public surface.
 *
 * Turns a Raw Brief + the Repository + the governed static laws into the seven derived Governance
 * Models as immutable, evidence-carrying, replayable, independently-verifiable artifacts — through
 * an injected ModelDeriver seam. Phase A boundary: the Models are derived and verified, NEVER
 * consumed downstream (no DiscoveryIntent projection, no obligation mapping).
 */
export * from './models.js';
export * from './deriver.js';
export * from './scripted-deriver.js';
export * from './verify-derivation.js';
