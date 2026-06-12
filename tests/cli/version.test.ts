import { describe, expect, it } from 'vitest';
import {
  VOKE_VERSION,
  MTQS_VERSION,
  versionString,
} from '../../packages/linter/src/version.js';

describe('version constants', () => {
  it('MTQS_VERSION is 0.1', () => {
    expect(MTQS_VERSION).toBe('0.1');
  });

  it('VOKE_VERSION matches semver pattern', () => {
    expect(VOKE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('versionString()', () => {
  it('returns the exact template "voke {VOKE_VERSION} (MTQS v0.1)"', () => {
    const result = versionString();
    expect(result).toMatch(/^voke \d+\.\d+\.\d+ \(MTQS v0\.1\)$/);
  });

  it('includes the actual VOKE_VERSION in the output', () => {
    const result = versionString();
    expect(result).toContain(VOKE_VERSION);
  });

  it('includes MTQS version in the output', () => {
    const result = versionString();
    expect(result).toContain(`MTQS v${MTQS_VERSION}`);
  });
});
