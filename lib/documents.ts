export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "csv",
  "docx",
  "xlsx",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

export function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension.replace(/[^a-z0-9]/g, "");
}

export function validateDocument(file: Pick<File, "name" | "size" | "type">) {
  const extension = getFileExtension(file.name);

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return "Choose a PDF, Office file, text file, CSV, or image.";
  }

  if (file.size <= 0) return "That file is empty.";

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return "Files must be 10 MB or smaller.";
  }

  if (file.type && !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return "This file type is not supported.";
  }

  return null;
}
