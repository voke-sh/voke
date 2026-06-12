import { describe, it, expect } from 'vitest';
import { parseSpecDoc } from '../../spec/helpers/parseSpecDoc.js';

describe('parseSpecDoc', () => {
  it('Test 1: extracts anchors including MTQS-S01 from a markdown section heading', () => {
    const markdown = `
# MTQS v0.1

## 3. Rules

### MTQS-S01: inputSchema Presence {#MTQS-S01}

Some content here.

### MTQS-A02: Annotation readOnlyHint {#MTQS-A02}

More content.
`;
    const result = parseSpecDoc(markdown);
    expect(result.anchors).toContain('MTQS-S01');
    expect(result.anchors).toContain('MTQS-A02');
  });

  it('Test 2: detects per-section good/bad example presence when both markers are present', () => {
    const markdown = `
### MTQS-S01: inputSchema Presence {#MTQS-S01}

Some rationale.

**Passing example:**
\`\`\`json
{ "type": "object" }
\`\`\`

**Failing example:**
\`\`\`json
null
\`\`\`

### MTQS-D03: Description Copy of Name {#MTQS-D03}

This section has no examples.
`;
    const result = parseSpecDoc(markdown);

    // MTQS-S01 has both examples
    expect(result.sections['MTQS-S01']?.hasGoodExample).toBe(true);
    expect(result.sections['MTQS-S01']?.hasBadExample).toBe(true);

    // MTQS-D03 has neither example
    expect(result.sections['MTQS-D03']?.hasGoodExample).toBe(false);
    expect(result.sections['MTQS-D03']?.hasBadExample).toBe(false);
  });
});
