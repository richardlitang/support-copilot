import type { ParsedDocument, ParsedSection } from "@/lib/types";

const SUPPORTED_EXTENSIONS = new Set(["md", "txt", "pdf"]);

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function getExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function splitMarkdownSections(text: string): ParsedSection[] {
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (content) {
      sections.push({
        title: currentTitle,
        content
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);

    if (heading) {
      flush();
      currentTitle = heading[2].trim();
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return sections;
}

function splitPlainSections(text: string): ParsedSection[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return [];
  }

  return blocks.map((content, index) => ({
    title: index === 0 ? "Overview" : null,
    content
  }));
}

export function parseTextDocument(input: {
  filename: string;
  contentType: string;
  text: string;
  sourceType?: ParsedDocument["sourceType"];
}) {
  const normalized = normalizeText(input.text);
  const extension = getExtension(input.filename);
  const sections =
    extension === "md" || input.contentType.includes("markdown")
      ? splitMarkdownSections(normalized)
      : splitPlainSections(normalized);

  if (!normalized) {
    throw new Error(`No text content extracted from ${input.filename}.`);
  }

  return {
    filename: input.filename,
    contentType: input.contentType,
    rawText: normalized,
    sections: sections.length
      ? sections
      : [
          {
            title: null,
            content: normalized
          }
        ],
    sourceType: input.sourceType ?? "upload"
  } satisfies ParsedDocument;
}

async function parsePdfDocument(file: File) {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const buffer = Buffer.from(await file.arrayBuffer());
  const candidate = (pdfParseModule as { default?: unknown }).default ?? (pdfParseModule as unknown);

  if (typeof candidate !== "function") {
    throw new Error("Unsupported pdf parser module shape. Expected parser function export.");
  }

  const parsed = await candidate(buffer);
  const text = (parsed as { text?: string }).text ?? "";

  return parseTextDocument({
    filename: file.name,
    contentType: file.type || "application/pdf",
    text,
    sourceType: "upload"
  });
}

async function parsePdfBuffer(input: { buffer: Buffer; filename: string; contentType: string }) {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const candidate = (pdfParseModule as { default?: unknown }).default ?? (pdfParseModule as unknown);

  if (typeof candidate !== "function") {
    throw new Error("Unsupported pdf parser module shape. Expected parser function export.");
  }

  const parsed = await candidate(input.buffer);
  const text = (parsed as { text?: string }).text ?? "";

  return parseTextDocument({
    filename: input.filename,
    contentType: input.contentType || "application/pdf",
    text,
    sourceType: "upload"
  });
}

export async function parseUploadedBuffer(input: { buffer: Buffer; filename: string; contentType: string }) {
  const extension = getExtension(input.filename);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file type for ${input.filename}. Upload .md, .txt, or .pdf files.`);
  }

  if (extension === "pdf") {
    return parsePdfBuffer(input);
  }

  return parseTextDocument({
    filename: input.filename,
    contentType: input.contentType || (extension === "md" ? "text/markdown" : "text/plain"),
    text: input.buffer.toString("utf8"),
    sourceType: "upload"
  });
}

export async function parseUploadedFile(file: File) {
  const extension = getExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file type for ${file.name}. Upload .md, .txt, or .pdf files.`);
  }

  if (extension === "pdf") {
    return parsePdfDocument(file);
  }

  return parseTextDocument({
    filename: file.name,
    contentType: file.type || (extension === "md" ? "text/markdown" : "text/plain"),
    text: await file.text(),
    sourceType: "upload"
  });
}
