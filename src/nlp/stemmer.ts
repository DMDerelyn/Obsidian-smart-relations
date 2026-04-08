/**
 * Porter Stemmer implementation in TypeScript.
 *
 * Based on the algorithm described by Martin Porter (1980).
 * Reference: https://tartarus.org/martin/PorterStemmer/def.txt
 */

// A consonant is a letter other than A, E, I, O, U, and other than Y preceded by a consonant.
function isConsonant(word: string, i: number): boolean {
  const c = word[i];
  if (c === "a" || c === "e" || c === "i" || c === "o" || c === "u") return false;
  if (c === "y") {
    if (i === 0) return true;
    return !isConsonant(word, i - 1);
  }
  return true;
}

/**
 * Measure m: the number of VC (vowel-consonant) sequences in the stem.
 * [C](VC)^m[V]
 */
function measure(word: string): number {
  let n = 0;
  let i = 0;
  const len = word.length;
  if (len === 0) return 0;

  // Skip leading consonants
  while (i < len && isConsonant(word, i)) i++;

  while (i < len) {
    // Skip vowels
    while (i < len && !isConsonant(word, i)) i++;
    if (i >= len) break;
    n++;
    // Skip consonants
    while (i < len && isConsonant(word, i)) i++;
  }

  return n;
}

/** Returns true if the stem contains a vowel */
function hasVowel(word: string): boolean {
  for (let i = 0; i < word.length; i++) {
    if (!isConsonant(word, i)) return true;
  }
  return false;
}

/** Returns true if the word ends with a double consonant (same letter repeated) */
function endsWithDoubleConsonant(word: string): boolean {
  const len = word.length;
  if (len < 2) return false;
  if (word[len - 1] !== word[len - 2]) return false;
  return isConsonant(word, len - 1);
}

/**
 * Returns true if the stem ends with CVC, where the second C is not W, X, or Y.
 * This is the *o condition in the Porter algorithm.
 */
function endsWithCVC(word: string): boolean {
  const len = word.length;
  if (len < 3) return false;
  if (
    !isConsonant(word, len - 1) ||
    isConsonant(word, len - 2) ||
    !isConsonant(word, len - 3)
  )
    return false;
  const c = word[len - 1];
  if (c === "w" || c === "x" || c === "y") return false;
  return true;
}

function endsWith(word: string, suffix: string): boolean {
  return word.length >= suffix.length && word.endsWith(suffix);
}

/**
 * If the word ends with the given suffix, replace it with the replacement
 * and return the new word; otherwise return null.
 */
function replaceSuffix(
  word: string,
  suffix: string,
  replacement: string
): string | null {
  if (!endsWith(word, suffix)) return null;
  const stem = word.slice(0, word.length - suffix.length);
  return stem + replacement;
}

/** Step 1a: Plurals */
function step1a(word: string): string {
  if (endsWith(word, "sses")) return word.slice(0, -2); // SSES -> SS
  if (endsWith(word, "ies")) return word.slice(0, -2);  // IES -> I
  if (endsWith(word, "ss")) return word;                 // SS -> SS
  if (endsWith(word, "s")) return word.slice(0, -1);     // S ->
  return word;
}

/** Step 1b: -ED and -ING */
function step1b(word: string): string {
  if (endsWith(word, "eed")) {
    const stem = word.slice(0, -3);
    if (measure(stem) > 0) return stem + "ee";
    return word;
  }

  let stemFound = "";
  let didRemove = false;

  if (endsWith(word, "ed")) {
    const stem = word.slice(0, -2);
    if (hasVowel(stem)) {
      stemFound = stem;
      didRemove = true;
    }
  } else if (endsWith(word, "ing")) {
    const stem = word.slice(0, -3);
    if (hasVowel(stem)) {
      stemFound = stem;
      didRemove = true;
    }
  }

  if (didRemove) {
    word = stemFound;
    if (endsWith(word, "at") || endsWith(word, "bl") || endsWith(word, "iz")) {
      return word + "e";
    }
    if (
      endsWithDoubleConsonant(word) &&
      !endsWith(word, "l") &&
      !endsWith(word, "s") &&
      !endsWith(word, "z")
    ) {
      return word.slice(0, -1);
    }
    if (measure(word) === 1 && endsWithCVC(word)) {
      return word + "e";
    }
  }

  return word;
}

/** Step 1c: Turn terminal Y to I when there is another vowel in the stem */
function step1c(word: string): string {
  if (endsWith(word, "y")) {
    const stem = word.slice(0, -1);
    if (hasVowel(stem)) {
      return stem + "i";
    }
  }
  return word;
}

/** Step 2: Map double suffixes to single ones */
function step2(word: string): string {
  const len = word.length;
  if (len < 2) return word;

  const mappings: Array<[string, string]> = [
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
  ];

  for (const [suffix, replacement] of mappings) {
    if (endsWith(word, suffix)) {
      const stem = word.slice(0, len - suffix.length);
      if (measure(stem) > 0) {
        return stem + replacement;
      }
      return word;
    }
  }

  return word;
}

/** Step 3: Deal with -IC-, -FULL, -NESS, etc. */
function step3(word: string): string {
  const mappings: Array<[string, string]> = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""],
  ];

  for (const [suffix, replacement] of mappings) {
    if (endsWith(word, suffix)) {
      const stem = word.slice(0, word.length - suffix.length);
      if (measure(stem) > 0) {
        return stem + replacement;
      }
      return word;
    }
  }

  return word;
}

/** Step 4: Remove -ANT, -ENCE, etc. */
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
    "ion",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
  ];

  for (const suffix of suffixes) {
    if (endsWith(word, suffix)) {
      const stem = word.slice(0, word.length - suffix.length);
      if (suffix === "ion") {
        // Special case: -ION requires the stem to end in S or T
        if (
          measure(stem) > 1 &&
          stem.length > 0 &&
          (stem[stem.length - 1] === "s" || stem[stem.length - 1] === "t")
        ) {
          return stem;
        }
      } else {
        if (measure(stem) > 1) {
          return stem;
        }
      }
      return word;
    }
  }

  return word;
}

/** Step 5a: Remove a trailing -E if measure > 1, or measure == 1 and not *o */
function step5a(word: string): string {
  if (endsWith(word, "e")) {
    const stem = word.slice(0, -1);
    const m = measure(stem);
    if (m > 1) return stem;
    if (m === 1 && !endsWithCVC(stem)) return stem;
  }
  return word;
}

/** Step 5b: Remove double consonant LL when measure > 1 */
function step5b(word: string): string {
  if (
    endsWithDoubleConsonant(word) &&
    endsWith(word, "ll") &&
    measure(word.slice(0, -1)) > 1
  ) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Stems a word using the Porter Stemming algorithm.
 * Returns the stemmed form of the word.
 */
export function stem(word: string): string {
  // Convert to lowercase for processing
  word = word.toLowerCase();

  // Words shorter than 3 characters pass through unchanged
  if (word.length < 3) return word;

  // Apply steps in order
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
