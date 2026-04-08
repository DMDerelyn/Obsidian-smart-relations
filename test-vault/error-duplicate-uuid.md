---
uuid: "df395a01-12c0-4758-a924-26c8b2d6e486"
type: knowledge
status: raw
created: "2026-04-07"
modified: "2026-04-08"
tags: [test, error-handling, duplicate]
related: []
summary: "This note deliberately uses a duplicate UUID (same as science-neural-networks.md) for testing."
---

# Test Note: Duplicate UUID

This note intentionally uses the **same UUID** as `science-neural-networks.md` (`df395a01-12c0-4758-a924-26c8b2d6e486`). The RAG indexer should detect this collision and handle it appropriately.

## Expected Behavior

When the indexer encounters duplicate UUIDs, it should:

1. Detect that the UUID has already been assigned to another note in the vault
2. Log a **warning or error** identifying both files that share the UUID
3. Apply a consistent conflict resolution strategy:
   - Option A: Keep the first note encountered, skip the second
   - Option B: Keep the most recently modified note
   - Option C: Skip both and require manual resolution
4. Continue processing the remaining vault files without corruption

## Why Duplicate UUIDs Occur

In practice, duplicate UUIDs can result from:

- **Copy-paste errors**: A user copies an existing note as a template and forgets to generate a new UUID
- **Merge conflicts**: When syncing vaults across devices, conflicting edits might duplicate entries
- **Import bugs**: Automated import tools might generate identical UUIDs under certain conditions
- **Manual assignment**: Users who manually assign UUIDs might accidentally reuse one

## Implications for the Index

A duplicate UUID in the index could cause serious problems:

- **Overwritten entries**: The second note's content might silently replace the first
- **Broken references**: Notes referencing the UUID would point to the wrong content
- **Inconsistent search results**: The same query might return different notes depending on index order
- **Relationship corruption**: The graph of note relationships could contain incorrect edges

The indexer must treat duplicate UUIDs as a **data integrity violation** and handle it defensively. Silent overwrites are the worst possible outcome because they cause data loss without any indication to the user.
