/**
 * Porter Stemmer implementation in TypeScript.
 *
 * Based on the algorithm described by Martin Porter (1980).
 * Reference: https://tartarus.org/martin/PorterStemmer/def.txt
 *
 * The algorithm works by applying a series of suffix-stripping rules
 * organized in five steps. It uses the concept of "measure" (m),
 * which counts the number of vowel-consonant (VC) sequences in the stem.
 */

// A consonant is any letter other than A, E, I, O, U, and Y when preceded by a consonant.
function isConsonant(word: string, i: number): boolean {
  const ch = word[i];
  if (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u") {
    return false;
  }
  if (ch === "y") {
    if (i === 0) {
      return true;
    }
    return !isConsonant(word, i - 1);
  }
  return true;
}

/**
 * Calculates the "measure" of a word — the number of VC sequences.
 * [C](VC)^m[V]
 */
function measure(word: string): number {
  let m = 0;
  let i = 0;
  const len = word.length;
  if (len === 0) return 0;

  // Skip leading consonants
  while (i < len && isConsonant(word, i)) {
    i++;
  }

  while (i < len) {
    // Skip vowels
    while (i < len && !isConsonant(word, i)) {
      i++;
    }
    if (i >= len) break;
    // Skip consonants
    while (i < len && isConsonant(word, i)) {
      i++;
    }
    m++;
  }

  return m;
}

/** Returns true if the stem contains a vowel */
function hasVowel(word: string): boolean {
  for (let i = 0; i < word.length; i++) {
    if (!isConsonant(word, i)) {
      return true;
    }
  }
  return false;
}

/** Returns true if the word ends with a double consonant */
function endsWithDoubleConsonant(word: string): boolean {
  const len = word.length;
  if (len < 2) return false;
  if (word[len - 1] !== word[len - 2]) return false;
  return isConsonant(word, len - 1);
}

/**
 * Returns true if the word ends with consonant-vowel-consonant
 * and the last consonant is not W, X, or Y.
 * This is the *o condition from the Porter Stemmer spec.
 */
function endsCVC(word: string): boolean {
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
  if (ch === "w" || ch === "x" || ch === "y") {
    return false;
  }
  return true;
}

/** Step 1a: Deals with plurals */
function step1a(word: string): string {
  if (word.endsWith("sses")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ies")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ss")) {
    return word;
  }
  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }
  return word;
}

/** Step 1b: Deals with -ED and -ING */
function step1b(word: string): string {
  if (word.endsWith("eed")) {
    const stem = word.slice(0, -3);
    if (measure(stem) > 0) {
      return word.slice(0, -1); // eed -> ee
    }
    return word;
  }

  let modified = false;
  let result = word;

  if (word.endsWith("ed")) {
    const stem = word.slice(0, -2);
    if (hasVowel(stem)) {
      result = stem;
      modified = true;
    }
  } else if (word.endsWith("ing")) {
    const stem = word.slice(0, -3);
    if (hasVowel(stem)) {
      result = stem;
      modified = true;
    }
  }

  if (modified) {
    if (
      result.endsWith("at") ||
      result.endsWith("bl") ||
      result.endsWith("iz")
    ) {
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

/** Step 1c: Turns terminal Y to I when there is another vowel in the stem */
function step1c(word: string): string {
  if (word.endsWith("y")) {
    const stem = word.slice(0, -1);
    if (hasVowel(stem)) {
      return stem + "i";
    }
  }
  return word;
}

/** Step 2: Maps double suffixes to single ones */
function step2(word: string): string {
  const suffixes: [string, string][] = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["izer", "ize"],
    ["abli", "able"],
    ["alli", "al"],
    ["entli", "ent"],
    ["eli", "e"],
    ["ousli", "ous"],
    ["ization", "ize"],
    ["ation", "ate"],
    ["ator", "ate"],
    ["alism", "al"],
    ["iveness", "ive"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["aliti", "al"],
    ["iviti", "ive"],
    ["biliti", "ble"],
    ["logi", "log"],
  ];

  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) {
        return stem + replacement;
      }
      return word;
    }
  }
  return word;
}

/** Step 3: Deals with -IC-, -FULL, -NESS, etc. */
function step3(word: string): string {
  const suffixes: [string, string][] = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""],
  ];

  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) {
        return stem + replacement;
      }
      return word;
    }
  }
  return word;
}

/** Step 4: Removes -ANT, -ENCE, -ER, etc. */
function step4(word: string): string {
  const suffixes = [
    "al",
    "ance",
    "ence",
    "er",
    "ic",
    "able",
    "ible",
    "ant",
    "ement",
    "ment",
    "ent",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
  ];

  // Special case for -ion: the stem must end in s or t
  if (word.endsWith("ion")) {
    const stem = word.slice(0, -3);
    if (
      measure(stem) > 1 &&
      stem.length > 0 &&
      (stem.endsWith("s") || stem.endsWith("t"))
    ) {
      return stem;
    }
  }

  for (const suffix of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 1) {
        return stem;
      }
      return word;
    }
  }
  return word;
}

/** Step 5a: Removes a final -E */
function step5a(word: string): string {
  if (word.endsWith("e")) {
    const stem = word.slice(0, -1);
    if (measure(stem) > 1) {
      return stem;
    }
    if (measure(stem) === 1 && !endsCVC(stem)) {
      return stem;
    }
  }
  return word;
}

/** Step 5b: Removes double consonant with -LL */
function step5b(word: string): string {
  if (word.endsWith("ll") && measure(word.slice(0, -1)) > 1) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Stems a word using the Porter Stemmer algorithm.
 * Words shorter than 3 characters are returned unchanged.
 */
export function stem(word: string): string {
  word = word.toLowerCase();

  if (word.length < 3) {
    return word;
  }

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
