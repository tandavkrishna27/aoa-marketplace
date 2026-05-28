---
name: aoa-design-shotgun-html
description: Generate 3–4 distinct HTML mockup variants for a UI component, compare approaches, and pick the best one.
---

# AoA Design Shotgun (HTML)

Generate multiple design variants for a UI component or page, then compare and select the best approach before implementation. Outputs standalone HTML files — no image generation required.

## When to Use

Use when a design decision has multiple viable approaches and you need to compare before committing. Do NOT use for trivial tweaks to an existing design — use design-review instead.

## Steps

1. **Clarify the design goal** — restate the component or page being designed and its primary use case in one sentence.

2. **Generate 3–4 variants** — each variant must represent a genuinely different approach (not just color changes):
   - Variant A: conservative / minimal / text-forward
   - Variant B: card-based / structured / data-dense
   - Variant C: bold / visual / large whitespace
   - Variant D (optional): unconventional / experimental

3. **For each variant**, produce:
   - A standalone HTML file with embedded CSS (no external dependencies)
   - A 2-sentence description of the design philosophy
   - A trade-off note: what this approach is optimized for vs. what it sacrifices

4. **Comparison table** — produce a markdown table scoring each variant on:
   - Clarity (1–5): how easy to understand at a glance
   - Density (1–5): how much information is visible without scrolling
   - Flexibility (1–5): how well it adapts to different content lengths
   - Implementation effort (1–5, lower = easier)

5. **Recommendation** — pick the variant that best fits the stated use case, explain in 2 sentences.

## Output Format

```
## Variant A — [name]
[description]
[trade-off]
[HTML inline or as file reference]

## Variant B — [name]
...

## Comparison
| | Clarity | Density | Flexibility | Effort |
|---|---|---|---|---|
| A | | | | |
...

## Recommendation
Variant X because [reason]. Proceed with [specific modifications if any].
```
