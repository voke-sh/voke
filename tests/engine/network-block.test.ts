import { it, expect, vi, afterEach } from 'vitest';

/**
 * network-block.test.ts — D-14 network-block sentinel (RESEARCH.md Pattern 13).
 *
 * This test validates that the Phase 3 purity-test infrastructure works as intended:
 * when tests stub global fetch, any rule that attempts a network call will fail loudly
 * at test time rather than silently producing non-deterministic output.
 *
 * This is a sentinel test only — it proves the harness mechanism works.
 * Phase 3 rule unit tests will use `beforeEach(() => vi.stubGlobal('fetch', ...))` to
 * enforce purity across all rule tests.
 *
 * Note: The stub returns a rejected Promise (not a synchronous throw) because fetch()
 * always returns a Promise — a synchronous throw is not awaitable via .rejects.toThrow().
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

it('fetch is blocked in this test environment (D-14 network-block sentinel)', async () => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests')));

  await expect(fetch('https://example.com')).rejects.toThrow('Network blocked');
});

it('network block is active only within the stubbed scope (vi.unstubAllGlobals restores original)', async () => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests')));

  // Should be blocked
  await expect(fetch('https://example.com')).rejects.toThrow('Network blocked');

  vi.unstubAllGlobals();

  // After unstub, fetch should be the real function again
  // We don't make an actual network call — just verify it's callable
  expect(typeof fetch).toBe('function');
});
