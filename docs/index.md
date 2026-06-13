---
layout: home

hero:
  name: "MTQS"
  text: "MCP Tool Quality Specification"
  tagline: "An open, versioned, deterministic ruleset for MCP tool quality"
  actions:
    - theme: brand
      text: Read the Spec
      link: /spec/
    - theme: alt
      text: View on GitHub
      link: https://github.com/voke-sh/voke

features:
  - title: Deterministic
    details: Same input always yields same output, every run, on any platform. No model in the loop.
  - title: Open and Versioned
    details: Every rule is publicly documented, independently citable, and versioned. Old versions remain immutable.
  - title: CI-Ready
    details: Run voke lint in any CI pipeline. Fail builds below a quality threshold with --min-score.
---
