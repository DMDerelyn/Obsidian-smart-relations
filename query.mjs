#!/usr/bin/env node

/**
 * Smart Relations CLI Query Tool
 *
 * Standalone Node.js ESM script that queries pre-built Smart Relations indexes
 * from the command line, without needing Obsidian running.
 *
 * Usage:
 *   node query.mjs /path/to/vault "search query" [--top 10] [--tags "tag1,tag2"] [--json]
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Embedded Stopwords (copied from src/nlp/stopwords.ts — all 192)
// ============================================================================

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an",
  "and", "any", "are", "aren't", "as", "at", "be", "because", "been",
  "before", "being", "below", "between", "both", "but", "by", "can",
  "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
  "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
  "from", "further", "get", "got", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how",
  "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
  "isn't", "it", "it's", "its", "itself", "just", "let", "let's", "me",
  "might", "more", "most", "mustn't", "my", "myself", "no", "nor", "not",
  "now", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
  "ours", "ourselves", "out", "over", "own", "quite", "s", "same", "say",
  "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "t", "than", "that", "that's", "the", "their", "theirs",
  "them", "themselves", "then", "there", "there's", "these", "they",
  "they'd", "they'll", "they're", "they've", "this", "those", "through",
  "to", "too", "under", "until", "up", "upon", "us", "use", "used",
  "using", "very", "was", "wasn't", "we", "we'd", "we'll", "we're",
  "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
  "where's", "which", "while", "who", "who's", "whom", "why", "why's",
  "will", "with", "won't", "would", "wouldn't", "yet", "you", "you'd",
  "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
]);

// ============================================================================
// Embedded Porter Stemmer (copied from src/nlp/stemmer.ts)
// ============================================================================

function isConsonant(word, i) {
  const ch = word[i];
  if (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u") {
    return false;
  }
  if (ch === "y") {
    if (i === 0) return true;
    return !isConsonant(word, i - 1);
  }
  return true;
}

function measure(word) {
  let m = 0;
  let i = 0;
  const len = word.length;
  if (len === 0) return 0;

  while (i < len && isConsonant(word, i)) i++;

  while (i < len) {
    while (i < len && !isConsonant(word, i)) i++;
    if (i >= len) break;
    while (i < len && isConsonant(word, i)) i++;
    m++;
  }
  return m;
}

function hasVowel(word) {
  for (let i = 0; i < word.length; i++) {
    if (!isConsonant(word, i)) return true;
  }
  return false;
}

function endsWithDoubleConsonant(word) {
  const len = word.length;
  if (len < 2) return false;
  if (word[len - 1] !== word[len - 2]) return false;
  return isConsonant(word, len - 1);
}

function endsCVC(word) {
  const len = word.length;
  if (len < 3) return false;
  if (
    !isConsonant(word, len - 1) ||
    isConsonant(word, len - 2) ||
    !isConsonant(word, len - 3)
  ) {
    return false;
  }
  const ch = word[len - 1];
  if (ch === "w" || ch === "x" || ch === "y") return false;
  return true;
}

function step1a(word) {
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ies")) return word.slice(0, -2);
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function step1b(word) {
  if (word.endsWith("eed")) {
    const s = word.slice(0, -3);
    if (measure(s) > 0) return word.slice(0, -1);
    return word;
  }

  let modified = false;
  let result = word;

  if (word.endsWith("ed")) {
    const s = word.slice(0, -2);
    if (hasVowel(s)) { result = s; modified = true; }
  } else if (word.endsWith("ing")) {
    const s = word.slice(0, -3);
    if (hasVowel(s)) { result = s; modified = true; }
  }

  if (modified) {
    if (result.endsWith("at") || result.endsWith("bl") || result.endsWith("iz")) {
      result = result + "e";
    } else if (endsWithDoubleConsonant(result)) {
      const last = result[result.length - 1];
      if (last !== "l" && last !== "s" && last !== "z") {
        result = result.slice(0, -1);
      }
    } else if (measure(result) === 1 && endsCVC(result)) {
      result = result + "e";
    }
  }
  return result;
}

function step1c(word) {
  if (word.endsWith("y")) {
    const s = word.slice(0, -1);
    if (hasVowel(s)) return s + "i";
  }
  return word;
}

function step2(word) {
  const suffixes = [
    ["ational", "ate"], ["tional", "tion"], ["enci", "ence"],
    ["anci", "ance"], ["izer", "ize"], ["abli", "able"],
    ["alli", "al"], ["entli", "ent"], ["eli", "e"],
    ["ousli", "ous"], ["ization", "ize"], ["ation", "ate"],
    ["ator", "ate"], ["alism", "al"], ["iveness", "ive"],
    ["fulness", "ful"], ["ousness", "ous"], ["aliti", "al"],
    ["iviti", "ive"], ["biliti", "ble"], ["logi", "log"],
  ];
  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const s = word.slice(0, -suffix.length);
      if (measure(s) > 0) return s + replacement;
      return word;
    }
  }
  return word;
}

function step3(word) {
  const suffixes = [
    ["icate", "ic"], ["ative", ""], ["alize", "al"],
    ["iciti", "ic"], ["ical", "ic"], ["ful", ""], ["ness", ""],
  ];
  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const s = word.slice(0, -suffix.length);
      if (measure(s) > 0) return s + replacement;
      return word;
    }
  }
  return word;
}

function step4(word) {
  const suffixes = [
    "al", "ance", "ence", "er", "ic", "able", "ible", "ant",
    "ement", "ment", "ent", "ou", "ism", "ate", "iti", "ous",
    "ive", "ize",
  ];

  if (word.endsWith("ion")) {
    const s = word.slice(0, -3);
    if (measure(s) > 1 && s.length > 0 && (s.endsWith("s") || s.endsWith("t"))) {
      return s;
    }
  }

  for (const suffix of suffixes) {
    if (word.endsWith(suffix)) {
      const s = word.slice(0, -suffix.length);
      if (measure(s) > 1) return s;
      return word;
    }
  }
  return word;
}

function step5a(word) {
  if (word.endsWith("e")) {
    const s = word.slice(0, -1);
    if (measure(s) > 1) return s;
    if (measure(s) === 1 && !endsCVC(s)) return s;
  }
  return word;
}

function step5b(word) {
  if (word.endsWith("ll") && measure(word.slice(0, -1)) > 1) {
    return word.slice(0, -1);
  }
  return word;
}

function stem(word) {
  word = word.toLowerCase();
  if (word.length < 3) return word;
  word = step1a(word);
  word = step1b(word);
  word = step1c(word);
  word = step2(word);
  word = step3(word);
  word = step4(word);
  word = step5a(word);
  word = step5b(word);
  return word;
}

// ============================================================================
// Tokenizer
// ============================================================================

function tokenize(text) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  return words.filter((w) => !STOPWORDS.has(w)).map((w) => stem(w));
}

// ============================================================================
// BM25 Scoring (same formula as src/scoring/BM25Scorer.ts)
// ============================================================================

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/**
 * IDF using BM25 variant that avoids negative values.
 * IDF(t) = log((N - n(t) + 0.5) / (n(t) + 0.5) + 1)
 */
function computeIdf(df, N) {
  return Math.log((N - df + 0.5) / (df + 0.5) + 1);
}

/**
 * BM25 term score:
 * IDF(t) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
 */
function computeTermScore(tf, idf, dl, avgdl) {
  const numerator = tf * (BM25_K1 + 1);
  const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * dl / avgdl);
  return idf * (numerator / denominator);
}

/**
 * Score all documents against a set of query terms using BM25.
 * Returns Map<uuid, score>.
 */
function scoreBM25(queryTerms, termIndex, documentStats, corpusStats) {
  const scores = new Map();
  const N = corpusStats.totalDocuments || 1;
  const avgdl = corpusStats.avgDocumentLength || 1;

  for (const term of queryTerms) {
    const postings = termIndex[term];
    if (!postings) continue;

    const idf = computeIdf(postings.length, N);

    for (const posting of postings) {
      const docStat = documentStats[posting.uuid];
      const dl = docStat ? docStat.wordCount : avgdl;
      const termScore = computeTermScore(posting.tf, idf, dl, avgdl);
      scores.set(posting.uuid, (scores.get(posting.uuid) ?? 0) + termScore);
    }
  }

  return scores;
}

// ============================================================================
// Jaccard Tag Scoring
// ============================================================================

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============================================================================
// Term Overlap Score
// ============================================================================

/**
 * Fraction of query terms that appear in the document.
 */
function termOverlapScore(queryTerms, uuid, termIndex) {
  if (queryTerms.length === 0) return 0;
  let hits = 0;
  for (const term of queryTerms) {
    const postings = termIndex[term];
    if (postings && postings.some((p) => p.uuid === uuid)) {
      hits++;
    }
  }
  return hits / queryTerms.length;
}

// ============================================================================
// Index Loading
// ============================================================================

function loadIndex(vaultPath) {
  const pluginDir = join(vaultPath, ".obsidian", "plugins", "smart-relations");
  const files = {
    uuid: join(pluginDir, "_uuid_index.json"),
    term: join(pluginDir, "_term_index.json"),
    corpus: join(pluginDir, "_corpus_stats.json"),
    document: join(pluginDir, "_document_stats.json"),
  };

  // Check that the plugin directory exists
  if (!existsSync(pluginDir)) {
    return { error: "No indexes found. Open Obsidian and run 'Reindex vault' first." };
  }

  // Check each required file
  for (const [name, filePath] of Object.entries(files)) {
    if (!existsSync(filePath)) {
      return {
        error: `Missing index file: ${filePath}\nOpen Obsidian and run 'Reindex vault' first.`,
      };
    }
  }

  try {
    return {
      uuidIndex: JSON.parse(readFileSync(files.uuid, "utf-8")),
      termIndex: JSON.parse(readFileSync(files.term, "utf-8")),
      corpusStats: JSON.parse(readFileSync(files.corpus, "utf-8")),
      documentStats: JSON.parse(readFileSync(files.document, "utf-8")),
    };
  } catch (e) {
    return { error: `Failed to parse index files: ${e.message}` };
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv) {
  const args = argv.slice(2); // skip node and script path
  const result = {
    vaultPath: null,
    query: null,
    top: 10,
    tags: [],
    json: false,
    help: false,
  };

  const positional = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      i++;
    } else if (arg === "--json") {
      result.json = true;
      i++;
    } else if (arg === "--top") {
      i++;
      if (i < args.length) {
        const n = parseInt(args[i], 10);
        if (!isNaN(n) && n > 0) result.top = n;
        i++;
      }
    } else if (arg === "--tags") {
      i++;
      if (i < args.length) {
        result.tags = args[i]
          .split(",")
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter((t) => t.length > 0);
        i++;
      }
    } else if (arg.startsWith("-")) {
      // Unknown flag — skip
      i++;
    } else {
      positional.push(arg);
      i++;
    }
  }

  if (positional.length >= 1) result.vaultPath = positional[0];
  if (positional.length >= 2) result.query = positional[1];

  return result;
}

// ============================================================================
// Usage / Help
// ============================================================================

function printUsage() {
  console.log(`
Smart Relations CLI Query Tool

Usage:
  node query.mjs <vault-path> "<query>" [options]

Arguments:
  vault-path        Path to the Obsidian vault directory
  query             Search query string

Options:
  --top N           Maximum number of results to show (default: 10)
  --tags "t1,t2"    Boost results matching these tags (comma-separated)
  --json            Output results as JSON
  --help, -h        Show this help message

Examples:
  node query.mjs ~/my-vault "dragon combat mechanics"
  node query.mjs ~/my-vault "spellcasting rules" --top 5
  node query.mjs ~/my-vault "alchemy" --tags "crafting,potions" --json
`);
}

// ============================================================================
// Query Execution
// ============================================================================

function executeQuery(queryString, indexes, tags, topN) {
  const { uuidIndex, termIndex, corpusStats, documentStats } = indexes;

  // Tokenize the query
  const queryTerms = tokenize(queryString);
  if (queryTerms.length === 0) {
    return { query: queryString, results: [] };
  }

  // Compute BM25 scores
  const bm25Scores = scoreBM25(queryTerms, termIndex, documentStats, corpusStats);

  // Collect all candidate UUIDs (any doc that got a BM25 score)
  const candidateUuids = new Set(bm25Scores.keys());

  // If tags provided, also include docs that match tags
  const queryTagSet = new Set(tags);
  if (queryTagSet.size > 0) {
    for (const [uuid, entry] of Object.entries(uuidIndex)) {
      const docTags = (entry.tags || []).map((t) => t.toLowerCase().replace(/^#/, ""));
      const docTagSet = new Set(docTags);
      if (jaccardSimilarity(queryTagSet, docTagSet) > 0) {
        candidateUuids.add(uuid);
      }
    }
  }

  // Score all candidates
  const results = [];
  // Normalize BM25 scores for combining
  let maxBM25 = 0;
  for (const score of bm25Scores.values()) {
    if (score > maxBM25) maxBM25 = score;
  }

  for (const uuid of candidateUuids) {
    const entry = uuidIndex[uuid];
    if (!entry) continue;

    const rawBM25 = bm25Scores.get(uuid) ?? 0;
    const normBM25 = maxBM25 > 0 ? rawBM25 / maxBM25 : 0;

    // Term overlap
    const overlap = termOverlapScore(queryTerms, uuid, termIndex);

    // Jaccard tag score
    let jaccard = 0;
    if (queryTagSet.size > 0) {
      const docTags = (entry.tags || []).map((t) => t.toLowerCase().replace(/^#/, ""));
      jaccard = jaccardSimilarity(queryTagSet, new Set(docTags));
    }

    // Combined score: weighted sum
    // BM25 is the primary signal (0.6), term overlap (0.2), tags (0.2)
    const hasTagQuery = queryTagSet.size > 0;
    let combined;
    if (hasTagQuery) {
      combined = 0.6 * normBM25 + 0.2 * overlap + 0.2 * jaccard;
    } else {
      // No tag query — redistribute tag weight to BM25 and overlap
      combined = 0.75 * normBM25 + 0.25 * overlap;
    }

    results.push({
      uuid,
      path: entry.path,
      title: entry.title || entry.path.replace(/\.md$/, "").split("/").pop(),
      tags: entry.tags || [],
      scores: {
        bm25: parseFloat(normBM25.toFixed(3)),
        jaccard: parseFloat(jaccard.toFixed(3)),
        termOverlap: parseFloat(overlap.toFixed(3)),
      },
      combined: parseFloat(combined.toFixed(3)),
    });
  }

  // Sort by combined score descending
  results.sort((a, b) => b.combined - a.combined);

  // Take top N
  const topResults = results.slice(0, topN);

  return {
    query: queryString,
    queryTerms,
    totalFound: results.length,
    results: topResults.map((r, i) => ({
      rank: i + 1,
      score: r.combined,
      path: r.path,
      title: r.title,
      tags: r.tags,
      scores: r.scores,
    })),
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatHumanReadable(result, topN) {
  const lines = [];
  lines.push("");
  lines.push("Smart Relations Query Results");
  lines.push(`Query: "${result.query}"`);

  if (result.queryTerms && result.queryTerms.length > 0) {
    lines.push(`Stemmed terms: [${result.queryTerms.join(", ")}]`);
  }

  const showing = Math.min(result.results.length, topN);
  lines.push(
    `Found ${result.totalFound} relevant note${result.totalFound !== 1 ? "s" : ""}` +
    (result.totalFound > showing ? ` (showing top ${showing}):` : ":")
  );
  lines.push("");

  if (result.results.length === 0) {
    lines.push("  No matching notes found.");
    lines.push("");
    return lines.join("\n");
  }

  for (const r of result.results) {
    const score = r.score.toFixed(3);
    lines.push(`  ${r.rank.toString().padStart(3)}. [${score}] ${r.path}`);
    if (r.tags.length > 0) {
      lines.push(`       Tags: ${r.tags.join(", ")}`);
    }
    lines.push(
      `       BM25: ${r.scores.bm25.toFixed(2)} | Tags: ${r.scores.jaccard.toFixed(2)} | Terms: ${r.scores.termOverlap.toFixed(2)}`
    );
    lines.push("");
  }

  return lines.join("\n");
}

function formatJson(result) {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  if (!opts.vaultPath) {
    console.error("Error: vault path is required.\n");
    printUsage();
    process.exit(1);
  }

  if (!opts.query || opts.query.trim().length === 0) {
    console.error("Error: query string is required.\n");
    printUsage();
    process.exit(1);
  }

  // Validate vault path
  if (!existsSync(opts.vaultPath)) {
    console.error(`Error: vault path does not exist: ${opts.vaultPath}`);
    process.exit(1);
  }

  try {
    if (!statSync(opts.vaultPath).isDirectory()) {
      console.error(`Error: vault path is not a directory: ${opts.vaultPath}`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: cannot access vault path: ${opts.vaultPath}`);
    process.exit(1);
  }

  // Load indexes
  const indexes = loadIndex(opts.vaultPath);
  if (indexes.error) {
    console.error(`Error: ${indexes.error}`);
    process.exit(1);
  }

  // Execute query
  const result = executeQuery(opts.query, indexes, opts.tags, opts.top);

  // Output
  if (opts.json) {
    console.log(formatJson(result));
  } else {
    console.log(formatHumanReadable(result, opts.top));
  }
}

main();
