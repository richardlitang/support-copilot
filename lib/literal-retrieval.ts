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

const literalPatterns = [
  /`([^`]+)`/g,
  /\b[a-z]+_[a-z0-9_]+\b/g,
  /\b[a-z]+-[a-z0-9-]+\b/g,
  /\b[a-z0-9]+_id\b/gi,
  /\b[a-z]{2,}_[A-Za-z0-9_]{6,}\b/g,
  /\b[A-Z][A-Z0-9_]{3,}\b/g,
];

function normalizeLiteral(value: string) {
  return value.trim().replace(/^['"`]+|['"`.,:;!?]+$/g, "");
}

export function extractLikelyLiterals(input: string) {
  const literals = new Set<string>();

  for (const pattern of literalPatterns) {
    for (const match of input.matchAll(pattern)) {
      const literal = normalizeLiteral(match[1] ?? match[0]);

      if (literal.length < 4 || GENERIC_LITERAL_TOKENS.has(literal.toUpperCase())) {
        continue;
      }

      literals.add(literal);
    }
  }

  return Array.from(literals).slice(0, 8);
}
