import { describe, it, expect } from 'vitest';
import { RuleRegistry } from '../../packages/linter/src/engine/registry.js';
import { runRules, RuleExecutionError } from '../../packages/linter/src/engine/runner.js';
import type { RuleDefinition, Finding, RuleFunction } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';
import type { VokeConfig } from '../../packages/linter/src/config/types.js';

// ────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────

const makeTool = (name: string, overrides?: Partial<ToolSnapshot>): ToolSnapshot => ({
  toolId: name,
  contentHash: 'abc123',
  name,
  description: `Description for ${name}`,
  inputSchema: { type: 'object', properties: {} },
  ...overrides,
});

const makeRule = (
  id: string,
  fn: RuleFunction,
  overrides?: Partial<RuleDefinition>,
): RuleDefinition => ({
  id,
  description: `Rule ${id}`,
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: 'Fix it',
  mtqsVersion: '0.1',
  fn,
  ...overrides,
});

const makeRegistry = (rules: RuleDefinition[]): RuleRegistry => {
  const reg = new RuleRegistry();
  for (const rule of rules) reg.register(rule);
  return reg.seal();
};

const emptyConfig: VokeConfig = {};

// ────────────────────────────────────────────────────────────────────
// Fixtures: small fake surface
// ────────────────────────────────────────────────────────────────────

const SURFACE: ToolSnapshot[] = [
  makeTool('get_users'),
  makeTool('create_user'),
  makeTool('delete_user'),
];

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('runRules', () => {
  describe('per-tool routing (ENG-02)', () => {
    it('calls a per-tool rule fn once per tool in the surface', () => {
      const callLog: string[] = [];
      const trackingFn: RuleFunction = (ctx) => {
        callLog.push(ctx.tool!.toolId);
        return [];
      };
      const registry = makeRegistry([makeRule('MTQS-S01', trackingFn)]);
      runRules(SURFACE, registry, emptyConfig);
      expect(callLog).toHaveLength(3);
      expect(callLog.sort()).toEqual(['create_user', 'delete_user', 'get_users']);
    });

    it('passes the sorted surface to per-tool rules', () => {
      let capturedSurface: ReadonlyArray<ToolSnapshot> | null = null;
      const captureFn: RuleFunction = (ctx) => {
        capturedSurface = ctx.surface;
        return [];
      };
      const registry = makeRegistry([makeRule('MTQS-S01', captureFn)]);
      // Provide surface in reverse order; runner must sort it
      const reversed = [...SURFACE].reverse();
      runRules(reversed, registry, emptyConfig);
      expect(capturedSurface).not.toBeNull();
      const ids = (capturedSurface as unknown as ReadonlyArray<ToolSnapshot>).map(t => t.toolId);
      expect(ids).toEqual(['create_user', 'delete_user', 'get_users']);
    });
  });

  describe('server-scoped routing (ENG-02)', () => {
    it('calls a server-scoped rule fn exactly once with tool: null', () => {
      let callCount = 0;
      let capturedTool: ToolSnapshot | null | undefined = undefined;
      const serverFn: RuleFunction = (ctx) => {
        callCount++;
        capturedTool = ctx.tool;
        return [];
      };
      const registry = makeRegistry([makeRule('MTQS-N03', serverFn, { target: 'server' })]);
      runRules(SURFACE, registry, emptyConfig);
      expect(callCount).toBe(1);
      expect(capturedTool).toBeNull();
    });

    it('provides the full sorted surface to a server rule', () => {
      let capturedSurface: ReadonlyArray<ToolSnapshot> | null = null;
      const serverFn: RuleFunction = (ctx) => {
        capturedSurface = ctx.surface;
        return [];
      };
      const registry = makeRegistry([makeRule('MTQS-N03', serverFn, { target: 'server' })]);
      runRules(SURFACE, registry, emptyConfig);
      const ids = (capturedSurface as unknown as ReadonlyArray<ToolSnapshot>).map(t => t.toolId);
      expect(ids).toEqual(['create_user', 'delete_user', 'get_users']);
    });
  });

  describe('findings sort: toolId → ruleId → path (spec §4.4)', () => {
    it('returns findings sorted by toolId ascending', () => {
      // Rule fires on all tools, producing one finding per tool
      const findingFn: RuleFunction = (ctx) => [{
        ruleId: 'MTQS-S01',
        dimension: 'schema',
        severity: 'error',
        message: `Finding for ${ctx.tool!.toolId}`,
        location: { tool: ctx.tool!.toolId, path: ['inputSchema'] },
        fixHint: 'Fix it',
      }];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn)]);
      // Feed in non-sorted order
      const findings = runRules([SURFACE[2], SURFACE[0], SURFACE[1]], registry, emptyConfig);
      const toolIds = findings.map(f => f.location.tool);
      expect(toolIds).toEqual(['create_user', 'delete_user', 'get_users']);
    });

    it('sorts findings by ruleId within the same tool', () => {
      const findingFn: RuleFunction = (ctx) => [{
        ruleId: ctx.tool!.toolId === 'get_users' ? 'MTQS-S02' : 'MTQS-S01',
        dimension: 'schema',
        severity: 'error',
        message: 'Finding',
        location: { tool: ctx.tool!.toolId, path: [] },
        fixHint: 'Fix it',
      }];
      // Two rules, each producing a finding for each tool
      const findingFn2: RuleFunction = (ctx) => [{
        ruleId: 'MTQS-D01',
        dimension: 'description',
        severity: 'warning',
        message: 'Finding2',
        location: { tool: ctx.tool!.toolId, path: [] },
        fixHint: 'Fix it',
      }];
      const registry = makeRegistry([
        makeRule('MTQS-S01', findingFn),
        makeRule('MTQS-D01', findingFn2, { dimension: 'description', defaultSeverity: 'warning' }),
      ]);
      const surface = [makeTool('get_users')];
      const findings = runRules(surface, registry, emptyConfig);
      const ruleIds = findings.map(f => f.ruleId);
      // D01 comes before S01 alphabetically
      expect(ruleIds[0]).toBe('MTQS-D01');
    });

    it('sorts findings by path within the same tool and ruleId', () => {
      const findingFn: RuleFunction = (ctx) => [
        {
          ruleId: 'MTQS-S01',
          dimension: 'schema',
          severity: 'error',
          message: 'p2',
          location: { tool: ctx.tool!.toolId, path: ['z_property'] },
          fixHint: 'Fix it',
        },
        {
          ruleId: 'MTQS-S01',
          dimension: 'schema',
          severity: 'error',
          message: 'p1',
          location: { tool: ctx.tool!.toolId, path: ['a_property'] },
          fixHint: 'Fix it',
        },
      ];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn)]);
      const findings = runRules([makeTool('my_tool')], registry, emptyConfig);
      expect(findings[0].location.path).toEqual(['a_property']);
      expect(findings[1].location.path).toEqual(['z_property']);
    });
  });

  describe('severity override via config (ENG-01)', () => {
    it('skips a rule whose severity resolves to "off"', () => {
      const findingFn: RuleFunction = () => [{
        ruleId: 'MTQS-S01',
        dimension: 'schema',
        severity: 'error',
        message: 'Should be skipped',
        location: { tool: 'get_users', path: [] },
        fixHint: 'Fix it',
      }];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn)]);
      const config: VokeConfig = { severityOverrides: { 'MTQS-S01': 'off' as never } };
      // 'off' is a special sentinel — rule must be skipped
      const findings = runRules([makeTool('get_users')], registry, config as VokeConfig & { severityOverrides: Record<string, 'off'> });
      expect(findings).toHaveLength(0);
    });

    it('overrides the severity of findings when config.severityOverrides specifies a different level', () => {
      const findingFn: RuleFunction = (ctx) => [{
        ruleId: 'MTQS-S01',
        dimension: 'schema',
        severity: 'error', // raw finding — will be overridden
        message: 'Test',
        location: { tool: ctx.tool!.toolId, path: [] },
        fixHint: 'Fix it',
      }];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn, { defaultSeverity: 'error' })]);
      const config: VokeConfig = { severityOverrides: { 'MTQS-S01': 'warning' } };
      const findings = runRules([makeTool('get_users')], registry, config);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
    });
  });

  describe('fail-on-rule-throw (D-13)', () => {
    it('throws RuleExecutionError when a per-tool rule fn throws', () => {
      const throwingFn: RuleFunction = () => {
        throw new Error('Rule crashed');
      };
      const registry = makeRegistry([makeRule('MTQS-S01', throwingFn)]);
      expect(() => runRules([makeTool('get_users')], registry, emptyConfig)).toThrow(RuleExecutionError);
    });

    it('RuleExecutionError carries the correct ruleId', () => {
      const throwingFn: RuleFunction = () => { throw new Error('boom'); };
      const registry = makeRegistry([makeRule('MTQS-S01', throwingFn)]);
      let caught: unknown;
      try {
        runRules([makeTool('get_users')], registry, emptyConfig);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RuleExecutionError);
      expect((caught as RuleExecutionError).ruleId).toBe('MTQS-S01');
    });

    it('RuleExecutionError carries the correct toolId', () => {
      const throwingFn: RuleFunction = () => { throw new Error('boom'); };
      const registry = makeRegistry([makeRule('MTQS-S01', throwingFn)]);
      let caught: unknown;
      try {
        runRules([makeTool('specific_tool')], registry, emptyConfig);
      } catch (e) {
        caught = e;
      }
      expect((caught as RuleExecutionError).toolId).toBe('specific_tool');
    });

    it('throws RuleExecutionError with toolId "SERVER" for a throwing server-scoped rule', () => {
      const throwingFn: RuleFunction = () => { throw new Error('server rule crashed'); };
      const registry = makeRegistry([makeRule('MTQS-N03', throwingFn, { target: 'server' })]);
      let caught: unknown;
      try {
        runRules(SURFACE, registry, emptyConfig);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RuleExecutionError);
      expect((caught as RuleExecutionError).toolId).toBe('SERVER');
    });

    it('RuleExecutionError has a descriptive message', () => {
      const throwingFn: RuleFunction = () => { throw new Error('original cause'); };
      const registry = makeRegistry([makeRule('MTQS-S01', throwingFn)]);
      let caught: unknown;
      try {
        runRules([makeTool('get_users')], registry, emptyConfig);
      } catch (e) {
        caught = e;
      }
      const err = caught as RuleExecutionError;
      expect(err.message).toContain('MTQS-S01');
      expect(err.message).toContain('get_users');
    });
  });

  describe('empty surface and empty registry', () => {
    it('returns [] when surface is empty', () => {
      const findingFn: RuleFunction = (ctx) => [{
        ruleId: 'MTQS-S01', dimension: 'schema', severity: 'error',
        message: 'x', location: { tool: ctx.tool!.toolId, path: [] }, fixHint: 'f',
      }];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn)]);
      expect(runRules([], registry, emptyConfig)).toEqual([]);
    });

    it('returns [] when registry is empty', () => {
      const registry = makeRegistry([]);
      expect(runRules(SURFACE, registry, emptyConfig)).toEqual([]);
    });
  });

  describe('determinism — sorted output regardless of input order', () => {
    it('produces identical findings regardless of surface array order', () => {
      const findingFn: RuleFunction = (ctx) => [{
        ruleId: 'MTQS-S01',
        dimension: 'schema',
        severity: 'error',
        message: `Finding for ${ctx.tool!.toolId}`,
        location: { tool: ctx.tool!.toolId, path: ['inputSchema'] },
        fixHint: 'Fix it',
      }];
      const registry = makeRegistry([makeRule('MTQS-S01', findingFn)]);

      const order1 = runRules([SURFACE[0], SURFACE[1], SURFACE[2]], registry, emptyConfig);
      const order2 = runRules([SURFACE[2], SURFACE[0], SURFACE[1]], registry, emptyConfig);
      const order3 = runRules([SURFACE[1], SURFACE[2], SURFACE[0]], registry, emptyConfig);

      expect(JSON.stringify(order1)).toBe(JSON.stringify(order2));
      expect(JSON.stringify(order2)).toBe(JSON.stringify(order3));
    });
  });
});

describe('RuleExecutionError', () => {
  it('has name "RuleExecutionError"', () => {
    const err = new RuleExecutionError('MTQS-S01', 'get_users', new Error('cause'));
    expect(err.name).toBe('RuleExecutionError');
  });

  it('is an instance of Error', () => {
    const err = new RuleExecutionError('MTQS-S01', 'get_users', new Error('cause'));
    expect(err).toBeInstanceOf(Error);
  });

  it('exposes ruleId, toolId, and cause', () => {
    const cause = new Error('original');
    const err = new RuleExecutionError('MTQS-S01', 'get_users', cause);
    expect(err.ruleId).toBe('MTQS-S01');
    expect(err.toolId).toBe('get_users');
    expect(err.cause).toBe(cause);
  });
});
