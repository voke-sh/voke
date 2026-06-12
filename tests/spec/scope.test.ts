import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const scopePath = join(process.cwd(), 'spec', 'SCOPE.md');
const text = readFileSync(scopePath, 'utf8');

describe('spec/SCOPE.md boundary statements', () => {
  it('Test 1: SCOPE.md file exists and is non-empty', () => {
    expect(text.length).toBeGreaterThan(0);
  });

  it('Test 2: content contains a no-LLM-in-loop assertion', () => {
    const hasNoLlm = /no LLM/i.test(text);
    const hasLlmAsJudge = /LLM-as-judge/i.test(text);
    expect(hasNoLlm || hasLlmAsJudge).toBe(true);
  });

  it('Test 3: content contains no-gateway/proxy assertions', () => {
    expect(text).toMatch(/gateway/i);
    expect(text).toMatch(/proxy/i);
  });

  it('Test 4: content contains the no-L2+ boundary and the no-agent-eval boundary', () => {
    expect(text).toMatch(/L2/);
    expect(text).toMatch(/L4/i);
  });

  it('Test 5: content contains the determinism guarantee', () => {
    expect(text).toMatch(/determinis/i);
  });
});
