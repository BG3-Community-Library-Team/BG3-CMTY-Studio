/**
 * PF-034: Fuzzy Score — lightweight fuzzy matching for command palette.
 *
 * Scores a query string against a target string.  Returns a score and
 * array of matched character indices, or null if no match.
 *
 * Algorithm:
 *  - Greedily match query characters in order against the target.
 *  - Bonus for consecutive matches (+5 per consecutive char).
 *  - Bonus for matching at word boundaries (+10).
 *  - Bonus for exact prefix match (+20).
 *  - Base score: +1 per matched character.
 *  - Case-insensitive.
 */

export interface FuzzyResult {
  score: number;
  matches: number[];
}

export function fuzzyScore(query: string, target: string): FuzzyResult | null {
  if (!query) return { score: 0, matches: [] };

  const qLower = query.toLowerCase();
  const tLower = target.toLowerCase();

  const matches: number[] = [];
  let score = 0;
  let qi = 0;
  let lastMatchIdx = -2; // for consecutive detection

  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      matches.push(ti);
      score += 1; // base

      // Consecutive bonus
      if (ti === lastMatchIdx + 1) {
        score += 5;
      }

      // Word boundary bonus
      if (ti === 0 || /[\s\-_]/.test(target[ti - 1]) || (target[ti - 1] === target[ti - 1].toLowerCase() && target[ti] === target[ti].toUpperCase())) {
        score += 10;
      }

      lastMatchIdx = ti;
      qi++;
    }
  }

  // All query characters must match
  if (qi !== qLower.length) return null;

  // Exact prefix bonus
  if (tLower.startsWith(qLower)) {
    score += 20;
  }

  return { score, matches };
}
