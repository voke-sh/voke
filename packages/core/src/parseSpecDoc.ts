/**
 * parseSpecDoc: Extract anchors and per-section example presence from a spec markdown string.
 * Pure function — no IO, operates on a string.
 */

export interface SpecDocSection {
  hasGoodExample: boolean;
  hasBadExample: boolean;
}

export interface ParsedSpecDoc {
  anchors: string[];
  sections: Record<string, SpecDocSection>;
}

// Matches {#MTQS-S01}, {#MTQS-A06}, etc. — all valid v0.1 dimension letters
const ANCHOR_REGEX = /\{#(MTQS-[SDNPA]\d{2})\}/g;

// Matches a rule heading like: ### MTQS-S01: Short Name {#MTQS-S01}
const RULE_HEADING_REGEX = /^### MTQS-([SDNPA]\d{2}):[^\n]*\{#MTQS-([SDNPA]\d{2})\}/gm;

/**
 * Extract all {#MTQS-XXX} anchors from the markdown and for each anchored rule section,
 * detect presence of "**Passing example:**" and "**Failing example:**" labels.
 */
export const parseSpecDoc = (markdown: string): ParsedSpecDoc => {
  // Collect all anchor IDs
  const anchors: string[] = [];
  const anchorMatches = markdown.matchAll(ANCHOR_REGEX);
  for (const match of anchorMatches) {
    anchors.push(match[1]);
  }

  // Build per-section analysis
  const sections: Record<string, SpecDocSection> = {};

  // Find each rule heading and slice its section body
  const headingMatches = [...markdown.matchAll(RULE_HEADING_REGEX)];

  for (let i = 0; i < headingMatches.length; i++) {
    const match = headingMatches[i];
    const ruleId = `MTQS-${match[2]}`;
    const headingEnd = (match.index ?? 0) + match[0].length;

    // Section body: from end of heading to start of next ### heading (or end of doc)
    const nextHeadingIndex =
      i + 1 < headingMatches.length ? headingMatches[i + 1].index ?? markdown.length : markdown.length;

    const body = markdown.slice(headingEnd, nextHeadingIndex);

    sections[ruleId] = {
      hasGoodExample: body.includes('**Passing example:**'),
      hasBadExample: body.includes('**Failing example:**'),
    };
  }

  return { anchors, sections };
};
