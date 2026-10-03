import { describe, it, expect, afterEach } from 'vitest';
import { createSubagentActuator } from '../src/actuators/subagent.js';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ActuationRequest } from '../src/actuator.js';

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-actuate-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

const REQ: ActuationRequest = {
  pass: 'contrast',
  instruction: 'Fix the contrast findings. Better, not different.',
  html: '<main><p>hi</p></main>',
  priorViolations: [{ id: 'contrast:x', description: 'fails AA', outcome: 'escalated' }],
};

describe('createSubagentActuator', () => {
  it('writes a request file and returns the dispatch output', async () => {
    const dispatchDir = freshDir();
    const actuator = createSubagentActuator({
      dispatchDir,
      dispatch: async (req) => req.html.replace('hi', 'fixed'),
    });
    const result = await actuator.harden(REQ);
    expect(result.html).toBe('<main><p>fixed</p></main>');

    const reqPath = join(dispatchDir, 'contrast.request.md');
    expect(existsSync(reqPath)).toBe(true);
    const written = readFileSync(reqPath, 'utf8');
    expect(written).toContain('Fix the contrast findings');
    expect(written).toContain('contrast:x');
  });

  it('passes the full ActuationRequest to the dispatch callback', async () => {
    const dispatchDir = freshDir();
    let seen: ActuationRequest | undefined;
    const actuator = createSubagentActuator({
      dispatchDir,
      dispatch: async (req) => {
        seen = req;
        return req.html;
      },
    });
    await actuator.harden(REQ);
    expect(seen?.pass).toBe('contrast');
    expect(seen?.priorViolations).toHaveLength(1);
  });

  it('can skip the request file when writeRequestFile is false', async () => {
    const dispatchDir = freshDir();
    const actuator = createSubagentActuator({
      dispatchDir,
      writeRequestFile: false,
      dispatch: async (req) => req.html,
    });
    await actuator.harden(REQ);
    expect(existsSync(join(dispatchDir, 'contrast.request.md'))).toBe(false);
  });
});
