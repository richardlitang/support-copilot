const GENERIC_LITERAL_TOKENS = new Set([
  "API",
  "URL",
  "URI",
  "HTTP",
  "HTTPS",
  "JSON",
  "XML",
  "CSV",
  "PDF",
  "ID",
]);

const QUESTION_STOPWORDS = new Set([
  "about",
  "after",
  "does",
  "from",
  "have",
  "into",
  "is",
  "should",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

const exactCodePatterns = [
  /`([^`]+)`/g,
  /\b[A-Z]{2,}[-_][A-Z0-9_-]+\b/g,
  /\b[A-Z]+-\d+[A-Z0-9-]*\b/g,
  /\b[a-z]+_[a-z0-9_]+\b/g,
  /\b[a-z]+-[a-z0-9-]+\b/g,
  /\b[a-z0-9]+_id\b/gi,
  /\b[A-Z][A-Z0-9_]{3,}\b/g,
];

function normalizeLiteral(value: string) {
  return value.trim().replace(/^['"`]+|['"`.,:;!?]+$/g, "");
}

export function extractExactCodeLiterals(input: string) {
  const literals = new Set<string>();

  for (const pattern of exactCodePatterns) {
    for (const match of input.matchAll(pattern)) {
      const literal = normalizeLiteral(match[1] ?? match[0]);

      if (literal.length < 4 || GENERIC_LITERAL_TOKENS.has(literal.toUpperCase())) {
        continue;
      }

      literals.add(literal);
    }
  }

  return Array.from(literals)
    .sort((left, right) => input.indexOf(left) - input.indexOf(right))
    .slice(0, 8);
}

export function extractLikelyLiterals(input: string) {
  const literals = new Set(extractExactCodeLiterals(input));
  const words = input.match(/\b[A-Za-z][A-Za-z0-9]{2,}\b/g) ?? [];
  const shouldUseQuestionFallback = literals.size === 0 && words.length <= 12;

  if (shouldUseQuestionFallback) {
    for (const word of words) {
      const upper = word.toUpperCase();
      const lower = word.toLowerCase();
      const isShortAcronymCandidate = word.length <= 4;
      const normalized = isShortAcronymCandidate ? upper : lower;

      if (
        GENERIC_LITERAL_TOKENS.has(upper) ||
        QUESTION_STOPWORDS.has(lower) ||
        (!isShortAcronymCandidate && normalized.length < 4)
      ) {
        continue;
      }

      literals.add(normalized);
    }
  }

  return Array.from(literals)
    .sort((left, right) => input.toLowerCase().indexOf(left.toLowerCase()) - input.toLowerCase().indexOf(right.toLowerCase()))
    .slice(0, 8);
}
