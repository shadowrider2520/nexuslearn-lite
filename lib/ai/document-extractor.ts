/**
 * document-extractor.ts — NEW FILE
 *
 * Extracts readable text from uploaded document buffers.
 * Supports: .txt, .md, .csv, .pdf, .docx, .xlsx, .pptx
 * Images (.jpg, .jpeg, .png, .webp) return null — caller handles those via Groq vision.
 *
 * All imports are dynamic so unused parsers don't bloat the bundle.
 */

import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

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

  // ── Plain text formats ────────────────────────────────────────────────────
  if (["txt", "md", "csv"].includes(ext) || fileType?.startsWith("text/")) {
    return buffer.toString("utf-8").slice(0, MAX_CHARS);
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (ext === "pdf" || fileType === "application/pdf") {
    try {
      // pdf-parse exports differ between CJS and ESM builds.
      // Try the named export first (ESM), fall back to .default (CJS).
      const pdfModule = await import("pdf-parse");
      const pdfParse =
        typeof pdfModule === "function"
          ? pdfModule
          : (pdfModule as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default;
      const result = await pdfParse(buffer);
      const text = (result.text ?? "").trim();
      return text.length > 0
        ? text.slice(0, MAX_CHARS)
        : "[This PDF appears to be image-only or scanned — no extractable text found]";
    } catch {
      return "[PDF could not be read — it may be encrypted or corrupted]";
    }
  }

  // ── DOCX (Word) ───────────────────────────────────────────────────────────
  if (
    ext === "docx" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim().slice(0, MAX_CHARS);
    } catch {
      return "[Word document could not be read]";
    }
  }

  // ── XLSX (Excel) ──────────────────────────────────────────────────────────
  if (
    ext === "xlsx" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        lines.push(`[Sheet: ${sheetName}]`);
        lines.push(XLSX.utils.sheet_to_csv(sheet));
      }
      return lines.join("\n").slice(0, MAX_CHARS);
    } catch {
      return "[Excel file could not be read]";
    }
  }

  // ── PPTX (PowerPoint) ────────────────────────────────────────────────────
  // officeparser needs a file path, so we write to a temp file then clean up.
  if (
    ext === "pptx" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const tmpPath = join(tmpdir(), `${randomUUID()}.pptx`);
    try {
      await writeFile(tmpPath, buffer);
      // officeparser v4+ exposes parseOfficeAsync
      const op = await import("officeparser");
      const parseAsync = (
        op as unknown as {
          parseOfficeAsync: (path: string) => Promise<string>;
        }
      ).parseOfficeAsync;
      const text = await parseAsync(tmpPath);
      return (typeof text === "string" ? text.trim() : "").slice(0, MAX_CHARS);
    } catch {
      return "[PowerPoint file could not be read]";
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }

  // Images → return null so the caller uses vision API
  return null;
}
