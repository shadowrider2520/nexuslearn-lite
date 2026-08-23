"use client";

import type { RoomDocument } from "@/lib/types";

export function DocumentsPanel({
  documents,
  uploading,
  error,
  userId,
  onUpload,
  onDownload,
  onDelete,
}: {
  documents: RoomDocument[];
  uploading: boolean;
  error: string | null;
  userId: string;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (filePath: string, fileName: string) => void;
  onDelete: (documentId: string, filePath: string) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg">Documents</h2>
          <p className="mt-1 text-xs text-gray-500">PDF, Office, text, CSV, or image · up to 10 MB</p>
        </div>
        <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-gray-200">
          {uploading ? "Uploading..." : "Upload file"}
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
            onChange={onUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-xl"
            >
              <span className="min-w-0 truncate text-sm text-gray-200">
                📄 {document.file_name}
                <span className="ml-2 text-xs text-gray-500">
                  {Math.max(1, Math.ceil(document.file_size / 1024))} KB
                </span>
              </span>
              <div className="flex shrink-0 gap-3 pl-3">
                <button
                  onClick={() => onDownload(document.file_path, document.file_name)}
                  className="text-xs text-gray-400 underline transition hover:text-white"
                >
                  Download
                </button>
                {document.uploaded_by === userId && (
                  <button
                    onClick={() => onDelete(document.id, document.file_path)}
                    className="text-xs text-red-400/80 underline transition hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
