/**
 * document-extractor.ts
 *
 * Extracts readable text from uploaded document buffers.
 * Supports: .txt, .md, .csv, .pdf, .docx, .xlsx, .pptx
 * Images (.jpg, .jpeg, .png, .webp) return null — caller handles those via Groq vision.
 *
 * Uses officeparser to parse complex office and PDF binaries directly from buffers.
 */

/** Max characters extracted per document (keeps prompt size manageable). */
const MAX_CHARS = 20_000;

/** Max file size to attempt extraction on (5 MB). Larger files are skipped. */
export const MAX_EXTRACT_BYTES = 5 * 1024 * 1024;

/**
 * Returns true if the file is an image format (handled separately via vision).
 */
export function isImageFile(fileName: string, fileType: string | null): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (
    ["jpg", "jpeg", "png", "webp"].includes(ext) ||
    (!!fileType && fileType.startsWith("image/"))
  );
}

/**
 * Extracts readable text from a document buffer.
 *
 * Returns:
 * - A string with the extracted text (possibly truncated to MAX_CHARS)
 * - An error-hint string if parsing fails (so the AI knows the file exists)
 * - null for image files (caller should use vision API instead)
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType: string | null
): Promise<string | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  // ── Plain text formats (instant read) ──────────────────────────────────────
  if (["txt", "md", "csv"].includes(ext) || fileType?.startsWith("text/")) {
    return buffer.toString("utf-8").slice(0, MAX_CHARS);
  }

  // ── PDF (pdf-parse v2 + CanvasFactory for serverless compat) ──────────────
  if (ext === "pdf" || fileType === "application/pdf") {
    try {
      const { CanvasFactory } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory });
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      return text.length > 0
        ? text.slice(0, MAX_CHARS)
        : `[This PDF document appears to have no extractable text content]`;
    } catch (err) {
      console.error(`PDF extraction error:`, err);
      return `[PDF document could not be read — it may be encrypted, scanned, or corrupted]`;
    }
  }

  // ── Office XML Formats — DOCX, XLSX, PPTX (OfficeParser) ─────────────────
  if (
    ["docx", "xlsx", "pptx"].includes(ext) ||
    (fileType &&
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ].includes(fileType))
  ) {
    try {
      const { OfficeParser } = await import("officeparser");
      // Pass fileType so officeparser doesn't need to inspect the ZIP header
      const ast = await OfficeParser.parseOffice(buffer, { fileType: ext as "docx" | "xlsx" | "pptx" });
      const text = (ast.toText() ?? "").trim();
      return text.length > 0
        ? text.slice(0, MAX_CHARS)
        : `[This ${ext.toUpperCase()} document appears to have no extractable text content]`;
    } catch (err) {
      console.error(`${ext.toUpperCase()} extraction error:`, err);
      return `[${ext.toUpperCase()} document could not be read — it may be encrypted or corrupted]`;
    }
  }

  // Images or other unsupported binary formats → return null
  return null;
}
