export interface ExcerptLine {
  kind: "heading" | "bullet" | "text";
  text: string;
}

// Doc chunks arrive as raw markdown-ish text ("**Meaning:** ... - bullet").
// Split them into typed lines so the UI can render structure instead of asterisks.
export function getFormattedExcerptLines(excerpt: string): ExcerptLine[] {
  return excerpt
    .replace(/\r/g, "")
    .replace(/\*\*([^*]+):\*\*/g, "\n$1:\n")
    .replace(/\s+-\s+/g, "\n- ")
    .split(/\n+/)
    .map((line) => line.trim().replace(/\*\*/g, ""))
    .filter(Boolean)
    .map((line) => {
      if (line.endsWith(":")) {
        return { kind: "heading" as const, text: line.slice(0, -1) };
      }
      if (line.startsWith("- ")) {
        return { kind: "bullet" as const, text: line.slice(2) };
      }
      return { kind: "text" as const, text: line };
    });
}
