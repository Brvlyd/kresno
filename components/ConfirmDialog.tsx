/** Dialog konfirmasi generik utk aksi destruktif (hapus dll) — dipakai di POS, Servis,
 * Pegadaian, & Pembelian supaya tidak ada 4 versi popup konfirmasi yang mirip-mirip. */
export function ConfirmDialog({
  open, title, message, confirmLabel = "Ya, Hapus", cancelLabel = "Batal",
  confirming = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-500 text-base mb-6">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-base hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-base disabled:opacity-40 transition-colors"
          >
            {confirming ? "Menghapus..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
