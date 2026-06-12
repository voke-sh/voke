import { describe, it, expect } from 'vitest';
import { RuleRegistry } from '../../packages/linter/src/engine/registry.js';
import { runRules } from '../../packages/linter/src/engine/runner.js';
import type { RuleFunction } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';

/**
 * frozen-ctx.test.ts — verifies that rules receive a frozen RuleContext (D-14).
 *
 * Object.freeze + TypeScript strict mode means a rule that attempts to assign
 * a new value to a top-level context property will throw a TypeError at runtime.
 * This guards against rules accidentally corrupting the shared context that
 * subsequent rules rely on.
 */

const makeTool = (name: string): ToolSnapshot => ({
  toolId: name,
  contentHash: 'abc123',
  name,
  description: `Description for ${name}`,
  inputSchema: { type: 'object', properties: {} },
});

describe('Frozen RuleContext (D-14)', () => {
  it('throws when a rule attempts to assign to ctx.tool (top-level property mutation)', () => {
    const mutatingFn: RuleFunction = (ctx) => {
      // Attempt to mutate a top-level property — Object.freeze must reject this
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).tool = null;
      return [];
    };
    const reg = new RuleRegistry();
    reg.register({
      id: 'MTQS-S01',
      description: 'Mutating rule',
      dimension: 'schema',
      target: 'tool',
      defaultSeverity: 'error',
      fixHint: 'Fix it',
      mtqsVersion: '0.1',
      fn: mutatingFn,
    });
    reg.seal();
    // The mutation causes a TypeError from Object.freeze which runRules wraps in RuleExecutionError
    expect(() => runRules([makeTool('test_tool')], reg, {})).toThrow();
  });

  it('throws when a rule attempts to use Object.assign to mutate ctx', () => {
    const mutatingFn: RuleFunction = (ctx) => {
      // Object.assign to a frozen object throws in strict mode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.assign(ctx as any, { tool: null });
      return [];
    };
    const reg = new RuleRegistry();
    reg.register({
      id: 'MTQS-S01',
      description: 'Object.assign mutating rule',
      dimension: 'schema',
      target: 'tool',
      defaultSeverity: 'error',
      fixHint: 'Fix it',
      mtqsVersion: '0.1',
      fn: mutatingFn,
    });
    reg.seal();
    expect(() => runRules([makeTool('test_tool')], reg, {})).toThrow();
  });

  it('throws when a server-scoped rule attempts to mutate ctx', () => {
    const mutatingServerFn: RuleFunction = (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).surface = [];
      return [];
    };
    const reg = new RuleRegistry();
    reg.register({
      id: 'MTQS-N03',
      description: 'Mutating server rule',
      dimension: 'naming',
      target: 'server',
      defaultSeverity: 'error',
      fixHint: 'Fix it',
      mtqsVersion: '0.1',
      fn: mutatingServerFn,
    });
    reg.seal();
    expect(() => runRules([makeTool('test_tool')], reg, {})).toThrow();
  });

  it('does NOT throw when a rule only reads ctx properties (pure read-only access)', () => {
    const pureFn: RuleFunction = (ctx) => {
      // Only reading — this must not throw
      const _toolId = ctx.tool?.toolId;
      const _surfaceLen = ctx.surface.length;
      const _config = ctx.config;
      void _toolId; void _surfaceLen; void _config;
      return [];
    };
    const reg = new RuleRegistry();
    reg.register({
      id: 'MTQS-S01',
      description: 'Pure read rule',
      dimension: 'schema',
      target: 'tool',
      defaultSeverity: 'error',
      fixHint: 'Fix it',
      mtqsVersion: '0.1',
      fn: pureFn,
    });
    reg.seal();
    expect(() => runRules([makeTool('test_tool')], reg, {})).not.toThrow();
  });
});
