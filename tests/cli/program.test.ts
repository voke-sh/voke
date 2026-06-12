/**
 * Unit tests for resolveLintOpts (W2 — pure flag-resolution, no network, no process spawning).
 *
 * Tests verify:
 * a. --ci forces color off regardless of --color flag
 * b. NO_COLOR=1 env var forces color off
 * c. Unknown --output value throws UsageError
 * d. --min-score out of 0-100 range throws UsageError
 * e. Valid defaults are preserved
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { resolveLintOpts } from '../../packages/linter/src/cli/program.js';
import { UsageError } from '../../packages/linter/src/cli/resolve-target.js';

describe('resolveLintOpts — color flag resolution', () => {
  it('--ci forces color off regardless of color flag value', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: true,
      color: true, // normally would be on
      header: [],
      timeout: '30000',
    });
    expect(opts.color).toBe(false);
  });

  it('--no-color (color:false from commander) forces color off', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: false, // commander sets color=false when --no-color is passed
      header: [],
      timeout: '30000',
    });
    expect(opts.color).toBe(false);
  });

  it('color is true when --ci is false, --no-color is not set, and NO_COLOR is unset', () => {
    const saved = process.env['NO_COLOR'];
    delete process.env['NO_COLOR'];
    try {
      const opts = resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
      });
      expect(opts.color).toBe(true);
    } finally {
      if (saved !== undefined) process.env['NO_COLOR'] = saved;
    }
  });
});

describe('resolveLintOpts — NO_COLOR env var (D-16)', () => {
  let savedNoColor: string | undefined;

  beforeEach(() => {
    savedNoColor = process.env['NO_COLOR'];
  });

  afterEach(() => {
    if (savedNoColor !== undefined) {
      process.env['NO_COLOR'] = savedNoColor;
    } else {
      delete process.env['NO_COLOR'];
    }
  });

  it('NO_COLOR=1 forces color off', () => {
    process.env['NO_COLOR'] = '1';
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true, // would normally be on
      header: [],
      timeout: '30000',
    });
    expect(opts.color).toBe(false);
  });

  it('NO_COLOR="" (empty string) does NOT disable color', () => {
    process.env['NO_COLOR'] = '';
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.color).toBe(true);
  });
});

describe('resolveLintOpts — --output validation', () => {
  it('throws UsageError for unknown --output value', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'xyz',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
      }),
    ).toThrow(UsageError);
  });

  it('throws UsageError for empty --output value', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: '',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
      }),
    ).toThrow(UsageError);
  });

  it('accepts output=human', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.output).toBe('human');
  });

  it('accepts output=json', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'json',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.output).toBe('json');
  });
});

describe('resolveLintOpts — --min-score validation', () => {
  it('throws UsageError when --min-score is 150 (above 100)', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
        minScore: '150',
      }),
    ).toThrow(UsageError);
  });

  it('throws UsageError when --min-score is negative', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
        minScore: '-1',
      }),
    ).toThrow(UsageError);
  });

  it('throws UsageError when --min-score is not a number', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: '30000',
        minScore: 'abc',
      }),
    ).toThrow(UsageError);
  });

  it('accepts --min-score 0', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
      minScore: '0',
    });
    expect(opts.minScore).toBe(0);
  });

  it('accepts --min-score 100', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
      minScore: '100',
    });
    expect(opts.minScore).toBe(100);
  });

  it('minScore is undefined when not provided', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.minScore).toBeUndefined();
  });
});

describe('resolveLintOpts — --timeout validation', () => {
  it('throws UsageError when --timeout is 0', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: '0',
      }),
    ).toThrow(UsageError);
  });

  it('throws UsageError when --timeout is not a number', () => {
    expect(() =>
      resolveLintOpts('x.json', {
        output: 'human',
        ci: false,
        color: true,
        header: [],
        timeout: 'abc',
      }),
    ).toThrow(UsageError);
  });

  it('accepts --timeout 5000', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '5000',
    });
    expect(opts.timeout).toBe(5000);
  });
});

describe('resolveLintOpts — other options', () => {
  it('passes target through', () => {
    const opts = resolveLintOpts('myfile.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.target).toBe('myfile.json');
  });

  it('threads headers through', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: ['Authorization: Bearer token123'],
      timeout: '30000',
    });
    expect(opts.headers).toEqual(['Authorization: Bearer token123']);
  });

  it('verbose defaults to false', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
    });
    expect(opts.verbose).toBe(false);
  });

  it('verbose can be set to true', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
      verbose: true,
    });
    expect(opts.verbose).toBe(true);
  });

  it('saveSnapshot is threaded when set', () => {
    const opts = resolveLintOpts('x.json', {
      output: 'human',
      ci: false,
      color: true,
      header: [],
      timeout: '30000',
      saveSnapshot: '/tmp/snap.json',
    });
    expect(opts.saveSnapshot).toBe('/tmp/snap.json');
  });
});
