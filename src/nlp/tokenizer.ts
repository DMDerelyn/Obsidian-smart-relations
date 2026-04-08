import { STOPWORDS } from "./stopwords";
import { stem } from "./stemmer";

/**
 * Extracts the body text from a full markdown file content string,
 * stripping the YAML frontmatter (everything between first --- and second ---).
 */
export function extractBodyText(content: string): string {
  // Check if content starts with frontmatter delimiter
  if (!content.startsWith("---")) {
    return content;
  }

  // Find the closing --- (must be on its own line)
  // Start searching after the first ---
  const closingIndex = content.indexOf("\n---", 3);
  if (closingIndex === -1) {
    // No closing delimiter found; return the full content
    return content;
  }

  // Skip past the closing --- and the newline after it
  const afterFrontmatter = closingIndex + 4; // length of "\n---"
  if (afterFrontmatter >= content.length) {
    return "";
  }

  // Return everything after the closing ---, trimming the leading newline
  const body = content.slice(afterFrontmatter);
  return body.startsWith("\n") ? body.slice(1) : body;
}

/**
 * Strips markdown formatting from text.
 * Removes: headings (#), bold (**), italic (*/_), links [text](url),
 * embeds ![[...]], code blocks (``` and inline `), HTML tags, wikilinks [[...]]
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove fenced code blocks (```...```) including content
  result = result.replace(/```[\s\S]*?```/g, " ");

  // Remove inline code (`...`)
  result = result.replace(/`[^`\n]+`/g, " ");

  // Remove HTML tags
  result = result.replace(/<\/?[^>]+(>|$)/g, " ");

  // Remove images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, " ");

  // Remove embeds ![[...]]
  result = result.replace(/!\[\[([^\]]*)\]\]/g, " ");

  // Remove wikilinks [[text|display]] -> display, [[text]] -> text
  result = result.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  result = result.replace(/\[\[([^\]]*)\]\]/g, "$1");

  // Remove regular links [text](url) -> text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove heading markers (# ## ### etc.)
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italic markers
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/\*([^*]+)\*/g, "$1");
  result = result.replace(/___([^_]+)___/g, "$1");
  result = result.replace(/__([^_]+)__/g, "$1");
  result = result.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1");

  // Remove horizontal rules (lines that are only ---, ___, or ***)
  result = result.replace(/^[-*_]{3,}\s*$/gm, " ");

  // Remove blockquote markers
  result = result.replace(/^>\s?/gm, "");

  // Remove unordered list markers (-, *, +)
  result = result.replace(/^[\t ]*[-*+]\s+/gm, "");

  // Remove ordered list markers (1. 2. etc.)
  result = result.replace(/^[\t ]*\d+\.\s+/gm, "");

  // Collapse multiple whitespace into a single space
  result = result.replace(/\s+/g, " ");

  return result.trim();
}

/**
 * Tokenizes text into an array of stemmed, lowercase terms
 * with stopwords removed. Filters out tokens < 2 characters.
 */
export function tokenize(text: string): string[] {
  const stripped = stripMarkdown(text);
  const words = stripped
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  return words.filter((w) => !STOPWORDS.has(w)).map((w) => stem(w));
}

/**
 * Tokenizes text and preserves the character position of each token
 * in the ORIGINAL text (before stripping/processing).
 * Returns array of {term: stemmed_term, position: char_offset}.
 */
export function tokenizeWithPositions(
  text: string
): Array<{ term: string; position: number }> {
  const results: Array<{ term: string; position: number }> = [];

  // Use regex to find word boundaries in the raw text
  const wordRegex = /[a-zA-Z0-9]+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    const position = match.index;
    const lower = rawWord.toLowerCase();

    // Skip short tokens
    if (lower.length < 2) continue;

    // Skip stopwords
    if (STOPWORDS.has(lower)) continue;

    // Stem and record
    const stemmed = stem(lower);
    results.push({ term: stemmed, position });
  }

  return results;
}
