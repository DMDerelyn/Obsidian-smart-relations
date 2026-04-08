import { STOPWORDS } from "./stopwords";
import { stem } from "./stemmer";

/**
 * Extracts the body text from a full markdown file content string,
 * stripping the YAML frontmatter (everything between the first --- and second ---).
 */
export function extractBodyText(content: string): string {
  // Frontmatter must start at the very beginning of the file
  if (!content.startsWith("---")) {
    return content;
  }

  // Find the closing --- delimiter (must be on its own line)
  const closingIndex = content.indexOf("\n---", 3);
  if (closingIndex === -1) {
    // No closing delimiter found — treat the whole content as body
    return content;
  }

  // Skip past the closing --- and the newline that follows it
  const afterFrontmatter = closingIndex + 4; // "\n---".length === 4
  if (afterFrontmatter >= content.length) {
    return "";
  }

  const rest = content.slice(afterFrontmatter);
  // Strip the leading newline if present
  if (rest.startsWith("\n")) {
    return rest.slice(1);
  }
  if (rest.startsWith("\r\n")) {
    return rest.slice(2);
  }
  return rest;
}

/**
 * Strips markdown formatting from text.
 * Removes: headings, bold, italic, links, embeds,
 * code blocks (fenced and inline), HTML tags, wikilinks.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove fenced code blocks (```...```)
  result = result.replace(/```[\s\S]*?```/g, " ");

  // Remove inline code (`...`)
  result = result.replace(/`[^`\n]+`/g, " ");

  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, " ");

  // Remove images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, " ");

  // Remove embeds ![[...]]
  result = result.replace(/!\[\[[^\]]*\]\]/g, " ");

  // Remove wikilinks [[text|display]] -> display, or [[text]] -> text
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
  result = result.replace(/_([^_]+)_/g, "$1");

  // Remove horizontal rules (---, ___, ***)
  result = result.replace(/^[-*_]{3,}\s*$/gm, " ");

  // Remove blockquotes (>)
  result = result.replace(/^>\s*/gm, "");

  // Remove unordered list markers (- or * at start of line)
  result = result.replace(/^[\t ]*[-*+]\s+/gm, "");

  // Remove ordered list markers (1. 2. etc.)
  result = result.replace(/^[\t ]*\d+\.\s+/gm, "");

  // Remove strikethrough
  result = result.replace(/~~([^~]+)~~/g, "$1");

  // Remove highlight markers
  result = result.replace(/==([^=]+)==/g, "$1");

  // Collapse multiple whitespace into a single space
  result = result.replace(/\s+/g, " ");

  return result.trim();
}

/**
 * Tokenizes text into an array of stemmed, lowercase terms
 * with stopwords removed. Filters out tokens shorter than 2 characters.
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
  // Strip markdown to avoid indexing terms from code blocks, URLs, HTML tags
  const stripped = stripMarkdown(text);
  const wordRegex = /[a-zA-Z0-9]+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(stripped)) !== null) {
    const raw = match[0].toLowerCase();

    // Skip short tokens
    if (raw.length < 2) {
      continue;
    }

    // Skip stopwords
    if (STOPWORDS.has(raw)) {
      continue;
    }

    const stemmed = stem(raw);
    results.push({
      term: stemmed,
      position: match.index,
    });
  }

  return results;
}
