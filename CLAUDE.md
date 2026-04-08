# Smart Relations — Instructions for Claude Code

This vault uses the **Smart Relations** Obsidian plugin, which builds local RAG-style indexes over all markdown notes. You can use these indexes to efficiently find and read the most relevant notes when answering questions, instead of scanning the entire vault.

## Index Location

The indexes are stored as JSON files at:

```
.obsidian/plugins/smart-relations/
```

If the user's vault is at `/path/to/vault`, the indexes are at `/path/to/vault/.obsidian/plugins/smart-relations/`.

## Available Indexes

### `_uuid_index.json` — Note Catalog (Read This First)

Maps every note's UUID to its metadata. This is your starting point for any query.

```json
{
  "550e8400-e29b-41d4-a716-446655440000": {
    "path": "Research/neural-networks.md",
    "title": "Neural Networks",
    "type": "knowledge",
    "tags": ["science", "ai", "machine-learning"],
    "relationCount": 3,
    "lastModified": 1712534400000
  }
}
```

**Use this to:** Browse all notes, filter by tags or type, find note paths.

### `_term_index.json` — Inverted Term Index (For Text Search)

Maps every stemmed term to the documents containing it, with term frequency.

```json
{
  "neural": [
    { "uuid": "550e8400-...", "tf": 12, "positions": [45, 102, ...] },
    { "uuid": "f47ac10b-...", "tf": 3, "positions": [200] }
  ],
  "network": [
    { "uuid": "550e8400-...", "tf": 8, "positions": [52, 110, ...] }
  ]
}
```

**Use this to:** Find which notes mention specific terms. Higher `tf` = more mentions.

**Important:** Terms are Porter-stemmed. To search for "running", look up "run". To search for "networks", look up "network". Common transformations:
- Plurals: cats → cat, studies → studi, ponies → poni
- -ing: running → run, computing → comput
- -ed: connected → connect, learned → learn
- -tion: regulation → regul, classification → classif

### `_tag_cooccurrence.json` — Tag Relationships

Shows which tags appear together across notes.

```json
{
  "science": { "ai": 5, "research": 3, "ethics": 2 },
  "ai": { "science": 5, "legal": 2, "ethics": 4 }
}
```

**Use this to:** Find topically related areas, understand the vault's knowledge structure.

### `_relation_graph.json` — Note Connections

Bidirectional graph of explicit note-to-note relationships from frontmatter `related:` fields.

```json
{
  "550e8400-...": [
    { "target": "f47ac10b-...", "type": "related", "weight": 1.0 }
  ]
}
```

**Use this to:** Follow chains of related notes, find connected clusters.

### `_document_stats.json` — Document Statistics

Per-document word count, unique terms, and TF-IDF vector norm.

```json
{
  "550e8400-...": {
    "wordCount": 450,
    "uniqueTerms": 120,
    "avgTermFrequency": 3.75,
    "vectorNorm": 12.5,
    "lastModified": 1712534400000
  }
}
```

### `_corpus_stats.json` — Vault-Wide Statistics

```json
{
  "totalDocuments": 234,
  "avgDocumentLength": 380,
  "totalTerms": 8500
}
```

## How to Answer Questions Using the Indexes

### Method 1: CLI Query Tool (if Node.js is available)

Run the bundled query tool:

```bash
node query.mjs /path/to/vault "your search query" --top 10
```

This performs BM25 + tag + term overlap scoring and returns ranked results. Add `--json` for machine-readable output. Then read the top-scoring files.

### Method 2: Read Indexes Directly (no dependencies needed)

When the user asks a question about their vault, follow this process:

#### Step 1: Read the UUID index to understand the vault

```
Read .obsidian/plugins/smart-relations/_uuid_index.json
```

Scan the titles, tags, and types to get an overview. This file is usually small enough to read in one pass.

#### Step 2: Identify relevant terms

From the user's question, extract key terms. Apply basic stemming mentally:
- Drop common suffixes: -ing, -ed, -tion, -ly, -ness, -ment
- Handle plurals: drop trailing -s, -es

#### Step 3: Look up terms in the term index

```
Read .obsidian/plugins/smart-relations/_term_index.json
```

This file can be large. If it's too big to read at once, use Grep to search for specific terms:

```
Grep for "\"dragon\"" in .obsidian/plugins/smart-relations/_term_index.json
```

For each term, note which UUIDs appear and their term frequency (`tf`). Notes appearing for multiple query terms with high tf values are the most relevant.

#### Step 4: Rank by relevance

Count how many of your query terms each note matches. Weight by term frequency. The notes that match the most query terms with the highest frequencies are your best candidates.

Quick ranking heuristic (no math needed):
- Note matches 3+ query terms → **highly relevant**, read it
- Note matches 2 query terms → **relevant**, read if top results are thin
- Note matches 1 query term with high tf (>5) → **possibly relevant**
- Note matches 1 query term with low tf (1-2) → **skip unless desperate**

#### Step 5: Also check tags

Cross-reference the user's question topic with tags in the UUID index. If the user asks about "AI ethics", filter for notes tagged `ai`, `ethics`, or both.

#### Step 6: Read the top files

Use the `path` field from the UUID index to read the actual note content. Read the top 3-5 most relevant notes, then answer the question.

### Method 3: Tag-Based Discovery

If the user's question maps cleanly to a topic area:

1. Read `_uuid_index.json`
2. Filter entries by matching tags
3. Read those files directly

This is fastest when the vault is well-tagged and the question maps to a specific domain.

## Example Workflow

**User asks:** "What are the key concepts in contract law?"

1. Read `_uuid_index.json` — scan for notes with tags containing "legal" or "contract"
2. Find: `legal-contract-law-basics.md` (tags: legal, contracts, basics)
3. Also grep `_term_index.json` for "contract" — find additional notes mentioning contracts
4. Read the top 2-3 matching files
5. Answer using their content

**User asks:** "How do dragons relate to my creative writing notes?"

1. Grep `_term_index.json` for "dragon" — find all notes mentioning dragons
2. Cross-reference with UUID index to get paths and tags
3. Check `_relation_graph.json` for explicit connections between dragon-related notes
4. Read the connected notes
5. Answer showing the cross-domain connections

## Important Notes

- **Indexes may be stale** — If the user has edited notes since the last reindex, suggest they run "Reindex vault" in Obsidian first
- **The term index uses Porter stemming** — Search for stemmed forms, not raw words
- **UUIDs are the canonical identifiers** — Always use UUIDs to cross-reference between indexes, never file paths (paths can change)
- **The `_term_index.json` can be large** — For vaults with 1000+ notes, it may be several MB. Use Grep to search for specific terms rather than reading the whole file
- **All indexes are deterministic** — Same vault content always produces the same indexes. No randomness or external data
