---
name: aoa-thread-extract
description: Extract structured items from an AoA thread discussion entry and submit via submit_extracted_items.
---

# AoA Thread Extract

Read the discussion entry in your context. Identify the following item types and call `submit_extracted_items` with the structured results.

## Item Types

- **decision** — A choice that was made. Include: what was decided, who decided, any rationale given.
- **task** — An action item. Include: what needs doing, owner if mentioned, any deadline.
- **insight** — A non-obvious observation or learning from the discussion.
- **context** — Background information relevant to understanding the company, team, or product.
- **reference** — A link, document, tool, or resource mentioned.
- **preference** — A stated working style or operational preference of the team or a person.

## Rules

1. Only extract what is explicitly stated — do not infer or add items not discussed.
2. Each item must have a `type`, `content` (1–2 sentence summary), and `confidence` (high / medium / low).
3. Flag ambiguous items with `confidence: "low"` and a clarifying note in the description.
4. Do not output anything else — call `submit_extracted_items` only.
5. If the entry contains nothing worth extracting, call `submit_extracted_items` with an empty items array.

## Tool Call

```
submit_extracted_items({
  items: [
    {
      type: "decision" | "task" | "insight" | "context" | "reference" | "preference",
      content: "...",
      confidence: "high" | "medium" | "low",
      clarifyingNote?: "..."  // only when confidence is low
    }
  ]
})
```
