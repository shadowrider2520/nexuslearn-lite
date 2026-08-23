"use client";

type Doc = { id: string; file_name: string; file_path: string; uploaded_by: string };

export function DocumentsPanel({
  documents,
  uploading,
  userId,
  onUpload,
  onDownload,
  onDelete,
}: {
  documents: Doc[];
  uploading: boolean;
  userId: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (filePath: string, fileName: string) => void;
  onDelete: (docId: string, filePath: string) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg">Documents</h2>
        <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-gray-200">
          {uploading ? "Uploading..." : "Upload File"}
          <input type="file" onChange={onUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-xl"
            >
              <span className="truncate text-sm text-gray-200">📄 {doc.file_name}</span>
              <div className="flex shrink-0 gap-3 pl-3">
                <button
                  onClick={() => onDownload(doc.file_path, doc.file_name)}
                  className="text-xs text-gray-400 underline transition hover:text-white"
                >
                  Download
                </button>
                {doc.uploaded_by === userId && (
                  <button
                    onClick={() => onDelete(doc.id, doc.file_path)}
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