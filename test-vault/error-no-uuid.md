---
type: knowledge
status: raw
created: "2026-04-07"
modified: "2026-04-08"
tags: [test, error-handling]
related: []
summary: "This note deliberately lacks a UUID field for testing error handling in the indexer."
---

# Test Note: Missing UUID

This note is intentionally missing the `uuid` field from its YAML frontmatter. The RAG indexer should detect this omission and **skip this note** gracefully without crashing or corrupting the index.

## Expected Behavior

When the indexer encounters this note, it should:

1. Parse the YAML frontmatter successfully
2. Check for the presence of a `uuid` field
3. Log a warning indicating that this file lacks a required UUID
4. Skip the note and continue processing the remaining vault files

## Why This Matters

Robust error handling is essential for any indexing system that processes user-generated content. Users may:

- Create notes before learning the required frontmatter format
- Import notes from other systems that use different metadata schemas
- Accidentally delete or corrupt frontmatter fields during editing
- Use templates that omit required fields

The indexer should handle all of these cases without failing. A single malformed note should never prevent the rest of the vault from being indexed.

## Additional Test Considerations

This note also serves as a test for:

- Whether the indexer includes content from UUID-less notes in search results (it should not)
- Whether re-indexing after adding a UUID correctly picks up previously skipped notes
- Whether the error log provides actionable information for the user to fix the issue
