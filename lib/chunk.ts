import type { ChunkCandidate, ParsedDocument } from "@/lib/types";

const DEFAULT_MAX_CHARS = 1100;
const DEFAULT_OVERLAP_CHARS = 180;

function approximateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitLongUnit(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return [text];
  }

  if (looksLikeTroubleshootingTable(text)) {
    return splitTableUnit(text, maxChars);
  }

  const sentences = text
    .match(/[^.!?]+[.!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences?.length) {
    const chunks: string[] = [];
    let offset = 0;

    while (offset < text.length) {
      chunks.push(text.slice(offset, offset + maxChars).trim());
      offset += maxChars;
    }

    return chunks;
  }

  return sentences;
}

function looksLikeTroubleshootingTable(text: string) {
  return /MALFUNCTION\/FAULT|POSSIBLE CAUSE|CORRECTIVE ACTION|possible cause|corrective action/i.test(
    text,
  );
}

function splitTableUnit(text: string, maxChars: number) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > maxChars && current) {
      chunks.push(current);
      current = line;
      continue;
    }

    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function getParagraphUnits(content: string, maxChars: number) {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      return looksLikeTroubleshootingTable(trimmed) ? trimmed : trimmed.replace(/\s+/g, " ");
    })
    .filter(Boolean)
    .flatMap((paragraph) => splitLongUnit(paragraph, maxChars));
}

export function chunkParsedDocument(
  parsedDocument: ParsedDocument,
  options?: {
    maxChars?: number;
    overlapChars?: number;
  },
) {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options?.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const chunks: ChunkCandidate[] = [];
  let chunkIndex = 0;

  for (const [sectionIndex, section] of parsedDocument.sections.entries()) {
    const units = getParagraphUnits(section.content, maxChars);
    let current = "";

    const flush = () => {
      const normalized = current.trim();
      if (!normalized) {
        return;
      }

      chunks.push({
        chunkIndex,
        sectionTitle: section.title,
        content: normalized,
        tokenCount: approximateTokenCount(normalized),
        metadata: {
          filename: parsedDocument.filename,
          sourceType: parsedDocument.sourceType,
          sectionIndex,
        },
      });

      chunkIndex += 1;
      current = normalized.slice(Math.max(0, normalized.length - overlapChars));
    };

    for (const unit of units) {
      const next = current ? `${current}\n\n${unit}` : unit;

      if (next.length > maxChars && current) {
        flush();
        current = unit;
        continue;
      }

      current = next;
    }

    if (current.trim()) {
      const finalContent = current.trim();
      chunks.push({
        chunkIndex,
        sectionTitle: section.title,
        content: finalContent,
        tokenCount: approximateTokenCount(finalContent),
        metadata: {
          filename: parsedDocument.filename,
          sourceType: parsedDocument.sourceType,
          sectionIndex,
        },
      });
      chunkIndex += 1;
      current = "";
    }
  }

  return chunks;
}
