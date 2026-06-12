import { describe, expect, it } from 'vitest';
import {
  resolveTarget,
  UsageError,
} from '../../packages/linter/src/cli/resolve-target.js';
import type { ResolvedTarget, TransportKind } from '../../packages/linter/src/cli/resolve-target.js';

describe('resolveTarget — live (http/https)', () => {
  it('resolves https:// URL to kind=live', () => {
    const result = resolveTarget('https://mcp.apideck.dev/mcp');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'live',
      target: 'https://mcp.apideck.dev/mcp',
    });
  });

  it('resolves http:// URL to kind=live', () => {
    const result = resolveTarget('http://localhost:3000/mcp');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'live',
      target: 'http://localhost:3000/mcp',
    });
  });

  it('preserves the full target string including path', () => {
    const url = 'https://example.com/api/v2/mcp';
    const result = resolveTarget(url);
    expect(result.target).toBe(url);
  });
});

describe('resolveTarget — file paths', () => {
  it('resolves relative ./path to kind=file', () => {
    const result = resolveTarget('./snapshot.json');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'file',
      target: './snapshot.json',
    });
  });

  it('resolves path without leading ./ to kind=file', () => {
    const result = resolveTarget('snapshots/apideck.json');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'file',
      target: 'snapshots/apideck.json',
    });
  });

  it('resolves absolute paths to kind=file', () => {
    const result = resolveTarget('/var/data/snapshot.json');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'file',
      target: '/var/data/snapshot.json',
    });
  });

  it('resolves bare filename to kind=file', () => {
    const result = resolveTarget('apideck.json');
    expect(result).toEqual<ResolvedTarget>({
      kind: 'file',
      target: 'apideck.json',
    });
  });
});

describe('resolveTarget — schemeless host:port (D-06)', () => {
  it('throws UsageError for localhost:port path', () => {
    expect(() => resolveTarget('localhost:3000/mcp')).toThrow(UsageError);
  });

  it('throws UsageError with did-you-mean message for localhost:port', () => {
    let caught: UsageError | undefined;
    try {
      resolveTarget('localhost:3000/mcp');
    } catch (e) {
      caught = e as UsageError;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toMatch(/[Dd]id you mean http:\/\/localhost:3000\/mcp/);
  });

  it('throws UsageError for host:port without path', () => {
    expect(() => resolveTarget('example.com:8080/')).toThrow(UsageError);
  });

  it('UsageError has exitCode 3 (D-13)', () => {
    let caught: UsageError | undefined;
    try {
      resolveTarget('localhost:3000/mcp');
    } catch (e) {
      caught = e as UsageError;
    }
    expect(caught!.exitCode).toBe(3);
  });
});

describe('resolveTarget — unknown scheme', () => {
  it('throws UsageError for ftp:// scheme', () => {
    expect(() => resolveTarget('ftp://example.com/path')).toThrow(UsageError);
  });

  it('UsageError message lists supported schemes for unknown scheme', () => {
    let caught: UsageError | undefined;
    try {
      resolveTarget('ftp://example.com/path');
    } catch (e) {
      caught = e as UsageError;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toContain('ftp:');
    expect(caught!.message.toLowerCase()).toContain('supported');
  });

  it('throws UsageError for ws:// scheme', () => {
    expect(() => resolveTarget('ws://example.com/ws')).toThrow(UsageError);
  });

  it('UsageError has exitCode 3 for unknown scheme', () => {
    let caught: UsageError | undefined;
    try {
      resolveTarget('ftp://example.com/path');
    } catch (e) {
      caught = e as UsageError;
    }
    expect(caught!.exitCode).toBe(3);
  });
});

describe('TransportKind type', () => {
  it('kind is either live or file', () => {
    const kinds: TransportKind[] = ['live', 'file'];
    expect(kinds).toContain('live');
    expect(kinds).toContain('file');
  });
});
