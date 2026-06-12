/**
 * Type declaration shims for ajv subpath imports and ajv-formats.
 *
 * ajv v8 and ajv-formats v3 were written before package.json `exports` and lack
 * NodeNext-compatible subpath exports.
 * These ambient module declarations satisfy TypeScript's NodeNext resolver without
 * changing the import path in source files (which Ajv's own docs and the CLAUDE.md
 * stack guide prescribe).
 *
 * Runtime: Node.js resolves these via the classic CJS resolver (no exports needed),
 * so this is a type-only shim — no impact on runtime behavior.
 */

// Re-declare the ajv/dist/2020 module using minimal types needed by schema-checks.ts.
declare module 'ajv/dist/2020' {
  interface AjvOptions {
    strict?: boolean;
    loadSchema?: never; // loadSchema is explicitly disallowed (D-06)
    [key: string]: unknown;
  }

  /** Ajv2020 — JSON Schema 2020-12 validator (strict:false, no loadSchema). */
  class Ajv2020 {
    constructor(opts?: AjvOptions);
    validateSchema(schema: object): boolean;
    compile(schema: object): (data: unknown) => boolean;
    validate(schema: object | string, data: unknown): boolean;
    addFormat(name: string, format: unknown): this;
  }

  export default Ajv2020;
}

// Re-declare ajv-formats as a callable function plugin.
declare module 'ajv-formats' {
  // addFormats(ajv, opts?) — installs standard format validators into the ajv instance
  function addFormats(ajv: unknown, opts?: unknown): unknown;
  export default addFormats;
}
