# Smart Relations

A local RAG (Retrieval-Augmented Generation) indexing plugin for [Obsidian](https://obsidian.md). Smart Relations builds deterministic vectorization-like indexes over your vault's markdown notes, enabling semantic-style retrieval and relation discovery — entirely offline, with zero external API calls.

## What It Does

Smart Relations reads every markdown note in your vault, extracts its content and YAML frontmatter (including a UUID identifier), and builds six interconnected indexes that power fast, ranked retrieval:

| Index | Purpose |
|-------|---------|
| **UUID Index** | Maps each note's UUID to its path, title, type, tags, and modification time |
| **Term Index** | Inverted index mapping every stemmed term to the documents it appears in, with frequency and position data |
| **Tag Co-occurrence** | Tracks which tags appear together across your notes, enabling tag-based similarity |
| **N-gram Index** | Character-level trigram index for fuzzy title and summary matching |
| **Relation Graph** | Bidirectional graph of note-to-note connections from `related:` frontmatter fields |
| **Document Stats** | Per-document statistics including word count, unique terms, and TF-IDF vector norms |

When you open a note, the plugin scores every other note in your vault using four signals:

- **BM25** — The industry-standard ranking algorithm (same one used by Elasticsearch). Measures how relevant a document is to the terms in your current note.
- **Jaccard Tag Similarity** — Measures overlap between the current note's tags and every other note's tags.
- **Term Overlap** — Jaccard similarity on vocabulary (unique terms shared between documents, ignoring frequency).
- **Graph Proximity** — BFS traversal of the relation graph. Direct neighbors score highest; 2-hop and 3-hop connections score progressively lower.

These four scores are normalized to a 0–1 range and combined using configurable weights to produce a single ranked list of related notes.

## Key Features

- **Fully local** — No API calls, no cloud services, no data leaves your machine
- **Incremental indexing** — Only re-indexes notes that changed, with a 500ms debounce window for batching rapid edits
- **File lifecycle handling** — Properly handles note creation, modification, deletion, and renaming without corrupting indexes
- **Persistent indexes** — Indexes are saved to disk and loaded on plugin startup, so you don't re-index on every restart
- **Configurable scoring** — Adjust the weight of each scoring signal to match your workflow
- **Two related formats** — Supports both simple UUID arrays and rich objects with relation type metadata
- **Theme-compatible UI** — Uses Obsidian's CSS variables for seamless light/dark theme support

## Requirements

### Note Format

Every note in your vault must have a `uuid` field in its YAML frontmatter. This is the canonical identifier used for all cross-referencing:

```yaml
---
uuid: "550e8400-e29b-41d4-a716-446655440000"
type: knowledge
status: raw
created: "2026-04-07"
modified: "2026-04-07"
tags: [topic-ai, domain-research]
related: []
summary: "One-sentence description of this note."
---

# Your Note Title

Your content here.
```

**UUID rules:**
- Must be a valid UUID v4 (lowercase, hyphenated, 36 characters)
- Must be the first field in frontmatter
- Must be unique across the entire vault — duplicates are detected and flagged
- Must never change once assigned — UUIDs are immutable identifiers
- Notes without a UUID are logged as warnings and excluded from indexing

### Related Field Formats

The plugin supports two formats for the `related:` field, configurable in settings:

**Simple format** (array of UUID strings):
```yaml
related:
  - "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  - "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Rich format** (objects with relation type and auto-detection flag):
```yaml
related:
  - uuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    rel: "references"
    auto: true
  - uuid: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    rel: "supports"
    auto: false
```

The plugin can read both formats regardless of the setting. The setting only controls which format is used when *writing* new entries via the "Suggest relations" command.

## Installation

### Community Plugin Browser (Recommended)

> **Note:** Community plugin submission is pending. Once accepted, this will be the easiest way to install.

1. Open Obsidian Settings
2. Go to **Community plugins** and disable **Restricted mode** if needed
3. Click **Browse** and search for **Smart Relations**
4. Click **Install**, then **Enable**

No build tools, no dependencies — it just works.

### Manual Download (Available Now)

1. Go to the [latest GitHub Release](https://github.com/DMDerelyn/Obsidian-smart-relations/releases/latest)
2. Download three files: `main.js`, `manifest.json`, and `styles.css`
3. In your vault, create the folder `.obsidian/plugins/smart-relations/`
4. Place the three downloaded files into that folder
5. Open Obsidian Settings > **Community plugins** > Enable **Smart Relations**

The plugin will automatically build its indexes the first time it loads. You'll see a notice: "Smart Relations: Building index for the first time..."

### From Source (For Developers)

If you want to modify the plugin or contribute:

1. Clone the repository into your vault's plugins folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/DMDerelyn/Obsidian-smart-relations.git smart-relations
   cd smart-relations
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian Settings > **Community plugins**

### Development Mode

For live-reloading during development:

```bash
npm run dev
```

This watches for file changes and rebuilds automatically.

## Usage

### First Run

When the plugin loads for the first time (or when no saved indexes exist), it automatically performs a full vault reindex. This reads every markdown file, extracts frontmatter and content, and builds all six indexes. For a vault with ~1,000 notes, this takes roughly 5–10 seconds.

### Related Notes Panel

Open the related notes panel via:
- **Command palette**: `Smart Relations: Find related notes`
- The panel appears in the right sidebar

The panel automatically updates when you switch between notes. For each related note, it shows:
- The note title (click to navigate)
- A combined similarity score (color-coded: green > 0.7, yellow > 0.4, gray < 0.4)
- A collapsible score breakdown showing each individual signal (BM25, tag similarity, term overlap, graph proximity)

### Suggesting Relations

To add a related note to the current note's frontmatter:

1. Open the command palette
2. Run **Smart Relations: Suggest relations for current note**
3. A fuzzy search modal appears with the top related notes, ranked by score
4. Select a note — its UUID is automatically added to the `related:` field in your frontmatter

The format used (simple or rich) depends on your settings.

### Manual Reindex

If you've made bulk changes or want to force a full rebuild:
- Click the **network icon** in the ribbon (left sidebar), or
- Run **Smart Relations: Reindex vault** from the command palette

The status bar at the bottom shows indexing progress and current state:
- `SR: 234 notes | just now` — Indexes are loaded, 234 notes indexed
- `SR: Building term index...` — Reindexing in progress
- `SR: Not indexed` — No indexes loaded yet

### Incremental Updates

You don't need to manually reindex after normal edits. The plugin listens to vault events:

| Event | What Happens |
|-------|-------------|
| **Create** a new `.md` file | Indexed automatically (if it has a UUID) |
| **Modify** a file | Re-indexed after a 500ms debounce window |
| **Delete** a file | Removed from all six indexes, dangling references logged |
| **Rename** a file | Path updated in UUID index, full re-index queued |

## Settings

Open **Settings > Smart Relations** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| **Excluded folders** | *(empty)* | Comma-separated folder paths to skip during indexing (e.g., `templates, archive`) |
| **Rich related format** | On | Use `{uuid, rel, auto}` objects instead of plain UUID strings when writing to `related:` |
| **BM25 weight** | 0.40 | Weight of BM25 text relevance in the combined score |
| **Jaccard (tag) weight** | 0.20 | Weight of tag overlap similarity |
| **Term overlap weight** | 0.20 | Weight of vocabulary overlap (unique terms shared) |
| **Graph proximity weight** | 0.20 | Weight of relation graph distance |
| **Min similarity threshold** | 0.10 | Results below this combined score are filtered out |
| **Max related notes** | 20 | Maximum number of results shown in the panel |
| **N-gram size** | 3 | Character n-gram size for fuzzy matching (2–5) |

**Tip:** The four scoring weights should sum to 1.0 for balanced results. If you primarily organize by tags, increase the Jaccard weight. If your notes have rich `related:` fields, increase graph proximity.

## Claude Code Integration

Smart Relations indexes are designed to work with [Claude Code](https://claude.ai/code) for RAG-style queries over your vault. The plugin builds the indexes; Claude Code reads them to efficiently find and answer questions about your notes.

See `CLAUDE.md` in this repository for detailed instructions on how Claude Code uses the indexes.

### CLI Query Tool (Optional)

A standalone CLI query tool is included for users who have Node.js installed. This is **entirely optional** — the plugin works without it, and Claude Code can read the index files directly.

```bash
node query.mjs /path/to/vault "your search query" --top 10
```

The tool performs BM25 + tag + term overlap scoring against the pre-built indexes and outputs ranked results. Add `--json` for machine-readable output, or `--tags "tag1,tag2"` to boost results matching specific tags.

This tool has zero dependencies — it embeds its own Porter stemmer and stopword list.

## Architecture

```
src/
├── main.ts                      # Plugin entry point — wires everything together
├── settings.ts                  # Settings interface, defaults, and settings tab
├── nlp/
│   ├── tokenizer.ts             # Text tokenization, markdown stripping, position tracking
│   ├── stemmer.ts               # Porter Stemmer (embedded, zero dependencies)
│   └── stopwords.ts             # 192 English stopwords
├── utils/
│   ├── uuid.ts                  # UUID v4 validation and generation
│   ├── frontmatter.ts           # Parse frontmatter from Obsidian's MetadataCache
│   └── cache.ts                 # Index persistence via vault adapter
├── indexer/
│   ├── types.ts                 # Shared type definitions for all index artifacts
│   ├── IndexManager.ts          # Orchestrates all indexers, incremental updates
│   ├── UuidIndexer.ts           # UUID → metadata lookup
│   ├── TermIndexer.ts           # Inverted term index with BM25 IDF
│   ├── TagIndexer.ts            # Tag co-occurrence matrix
│   ├── NgramIndexer.ts          # Character n-gram index
│   ├── RelationGraphBuilder.ts  # Bidirectional relation graph with BFS
│   └── DocumentStats.ts         # Per-document statistics and TF-IDF norms
├── scoring/
│   ├── types.ts                 # ScoredResult and QuerySource types
│   ├── BM25Scorer.ts            # Okapi BM25 ranking (k1=1.5, b=0.75)
│   ├── JaccardScorer.ts         # Set similarity for tags and terms
│   └── CombinedScorer.ts        # Weighted multi-signal scoring with normalization
└── views/
    ├── RelatedNotesView.ts      # Side panel with ranked results
    └── SuggestionModal.ts       # Fuzzy search modal for adding relations
```

### How Scoring Works

Given a source note (or text query), the combined scorer:

1. **Tokenizes** the source content — strips markdown, removes stopwords, applies Porter stemming
2. **BM25 scores** all documents against the query terms using the inverted term index
3. **Jaccard tag scores** all documents by tag set overlap with the source
4. **Term overlap scores** all documents by vocabulary overlap (unique stemmed terms shared)
5. **Graph proximity scores** connected notes via BFS (score = 1/(distance+1))
6. **Normalizes** each score set to [0, 1] using min-max normalization
7. **Combines** with configured weights: `combined = w1*bm25 + w2*jaccard + w3*termOverlap + w4*graphProximity`
8. **Filters** results below the similarity threshold and returns the top N

### BM25 Formula

```
score(Q, D) = Σ IDF(qi) × (tf(qi,D) × (k1+1)) / (tf(qi,D) + k1 × (1 - b + b × |D|/avgdl))

IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
```

Where `N` = total documents, `n(qi)` = documents containing term qi, `tf` = term frequency, `|D|` = document length, `avgdl` = average document length, `k1` = 1.5, `b` = 0.75.

## Performance

| Operation | Target |
|-----------|--------|
| Full index rebuild (1,000 notes) | < 10 seconds |
| Full index rebuild (5,000 notes) | < 30 seconds |
| Incremental update (single file) | < 200ms |
| Query scoring (1,000 documents) | < 100ms |
| Index load from disk | < 1 second |
| Bundle size | 67 KB |

The plugin processes files in batches during full rebuilds, yielding to the UI thread between batches to prevent freezing.

## Error Handling

The plugin handles common edge cases gracefully:

- **Notes without UUID** — Logged as warnings, excluded from indexing
- **Duplicate UUIDs** — Both files flagged, first occurrence kept
- **Empty notes** — Indexed with zero-length stats, BM25 guards against division by zero
- **Very long notes** — Tokenization capped at 50,000 characters (configurable)
- **Dangling references** — UUID in `related:` pointing to a deleted note is logged but doesn't crash
- **Corrupted indexes** — If an index file fails to parse, it's rebuilt from scratch
- **Circular relations** — BFS traversal tracks visited nodes to prevent infinite loops

## License

MIT
