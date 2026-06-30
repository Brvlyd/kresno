import { fmtGram, fmtRp, fmtWaktuLengkap, fmtWaktuRiwayat, type RiwayatTransaksi } from "@/lib/riwayatTransaksi";

/* ═══════════════════════════════════════════════════════
   KOMPONEN: BARIS RIWAYAT TRANSAKSI (dipakai di list terakhir & halaman semua riwayat)
═══════════════════════════════════════════════════════ */
export function RiwayatRowItem({ r, onClick }: { r: RiwayatTransaksi; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-sm text-left hover:bg-amber-50/70 rounded-lg px-2 -mx-2 transition-colors"
    >
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate">
          {r.pelangganNama} <span className="text-gray-400 font-normal">· {r.noInvoice}</span>
        </p>
        <p className="text-xs text-gray-400 truncate">
          {r.items.map((it) => it.namaProduk).join(", ")} {r.paymentMethod && `· ${r.paymentMethod}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-400">{fmtWaktuRiwayat(r.createdAt)}</p>
        <p className="text-xs font-semibold" style={{ color: "#6F5333" }}>
          {r.total > 0 ? fmtRp(r.total) : `${r.totalQty} pcs`}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: MODAL DETAIL TRANSAKSI — popup per item yang sudah di-checkout
═══════════════════════════════════════════════════════ */
export function DetailRiwayatModal({ r, onClose, onPrint }: { r: RiwayatTransaksi; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detail Transaksi</h2>
            <p className="text-xs text-gray-400 font-mono">{r.noInvoice}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info pelanggan & transaksi */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Pelanggan</p>
              <p className="font-semibold text-gray-800">{r.pelangganNama}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">No. Telepon</p>
              <p className="font-semibold text-gray-800">{r.pelangganHp || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Waktu Transaksi</p>
              <p className="font-semibold text-gray-800">{fmtWaktuLengkap(r.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Metode Pembayaran</p>
              <p className="font-semibold text-gray-800">{r.paymentMethod || "—"}</p>
            </div>
          </div>

          {/* Item yang sudah di-checkout */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Barang yang Dibeli ({r.items.length})</h3>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-semibold">Barang</th>
                    <th className="text-center px-2 py-2 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold">Harga Satuan</th>
                    <th className="text-right px-3 py-2 font-semibold">Ongkos</th>
                    <th className="text-right px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-gray-50">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-gray-800">{it.namaProduk}</p>
                        <p className="text-xs text-gray-400">
                          {it.idItem}
                          {it.kadar ? ` · ${it.kadar}` : ""}
                          {it.beratGram ? ` · ${fmtGram(it.beratGram)}` : ""}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 text-center">{it.qty}</td>
                      <td className="px-3 py-2.5 text-right">{it.hargaSatuan ? fmtRp(it.hargaSatuan) : "—"}</td>
                      <td className="px-3 py-2.5 text-right">{it.ongkos ? fmtRp(it.ongkos) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#6F5333" }}>
                        {it.hargaSatuan ? fmtRp(it.hargaSatuan * it.qty + it.ongkos) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.items.every((it) => !it.hargaSatuan) && (
              <p className="text-xs text-gray-400 mt-2">
                Harga per item tidak tersedia — transaksi ini dicatat sebelum riwayat detail diaktifkan.
              </p>
            )}
          </div>

          {/* Ringkasan total */}
          {r.total > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">
              <div className="flex justify-between px-4 py-2 border-b border-gray-50">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-800">{fmtRp(r.subtotal)}</span>
              </div>
              {r.diskon > 0 && (
                <div className="flex justify-between px-4 py-2 border-b border-gray-50">
                  <span className="text-gray-500">Diskon</span>
                  <span className="font-semibold text-gray-800">− {fmtRp(r.diskon)}</span>
                </div>
              )}
              {r.ppnAmount > 0 && (
                <div className="flex justify-between px-4 py-2 border-b border-gray-50">
                  <span className="text-gray-500">PPN</span>
                  <span className="font-semibold text-gray-800">{fmtRp(r.ppnAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 font-bold text-white" style={{ backgroundColor: "#6F5333" }}>
                <span>TOTAL</span>
                <span>{fmtRp(r.total)}</span>
              </div>
            </div>
          )}

          {r.catatan && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Catatan</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{r.catatan}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 font-bold hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#6F5333", color: "#6F5333" }}
          >
            Tutup
          </button>
          <button
            onClick={onPrint}
            className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
            style={{ backgroundColor: "#6F5333" }}
          >
            🖨️ Lihat & Cetak Nota
          </button>
        </div>
      </div>
    </div>
  );
}
