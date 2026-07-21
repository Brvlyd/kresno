import { useRef, useState } from "react";
import StorageImage from "@/components/StorageImage";
import { AutocompleteField } from "@/components/AutocompleteField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import {
  fmtGram, fmtRp, fmtWaktuLengkap, fmtWaktuRiwayat, buildInventoriKeluarInserts,
  type RiwayatTransaksi,
} from "@/lib/riwayatTransaksi";

/** Bentuk minimal barang inventori yang dibutuhkan modal ini utk mencari & menambah
 * barang saat mengedit invoice — `app/pos/page.tsx`/`app/pos/riwayat/page.tsx` cukup
 * meneruskan daftar inventori (Tersedia & stok>0) yang sudah mereka muat, tanpa perlu
 * mengimpor tipe ini secara eksplisit (cocok secara struktural). */
export interface PosStockItem {
  id: string;
  id_item: string;
  nama_produk: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_jual: number;
  gambar_url?: string;
}

interface EditCartRow {
  rowId: string;
  /** Null = barang inventori aslinya sudah dihapus — qty/harga tetap bisa dikoreksi,
   * tapi tidak ada stok yang direkonsiliasi utk baris ini. */
  inventoriId: string | null;
  idItem: string;
  namaProduk: string;
  kadar: string;
  beratGram: number;
  hargaJual: number;
  ongkos: number;
  qty: number;
}

const PAYMENT_METHODS = ["Tunai", "Transfer", "Debit", "QRIS"] as const;

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

/* ─── Input Rupiah terformat (mis. "150.000") ─── */
function RpField({
  value, onChange, className = "",
}: { value: number; onChange: (v: number) => void; className?: string }) {
  const formatted = value > 0 ? value.toLocaleString("id-ID") : "";
  return (
    <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#C99A36] bg-white ${className}`}>
      <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 select-none shrink-0">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder="0"
        className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: MODAL DETAIL TRANSAKSI — lihat, edit, hapus, cetak ulang
═══════════════════════════════════════════════════════ */
export function DetailRiwayatModal({
  r, onClose, onPrint, inventoriItems, onSaved, onDeleted,
}: {
  r: RiwayatTransaksi;
  onClose: () => void;
  onPrint: () => void;
  /** Daftar barang inventori yang boleh ditambahkan saat edit (Tersedia & stok > 0). */
  inventoriItems: PosStockItem[];
  /** Dipanggil setelah edit tersimpan sukses — parent perlu refresh riwayat & stok. */
  onSaved: () => void;
  /** Dipanggil setelah invoice dihapus sukses — parent perlu refresh riwayat & stok. */
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const newRowSeq = useRef(0);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editPelangganNama, setEditPelangganNama] = useState("");
  const [editPelangganHp, setEditPelangganHp] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editDiskon, setEditDiskon] = useState("");
  const [editPpnEnabled, setEditPpnEnabled] = useState(false);
  const [editPpnPercent, setEditPpnPercent] = useState("11");
  const [editCatatan, setEditCatatan] = useState("");
  const [editCart, setEditCart] = useState<EditCartRow[]>([]);
  const [itemSearchText, setItemSearchText] = useState("");

  function openEdit() {
    setEditPelangganNama(r.pelangganNama);
    setEditPelangganHp(r.pelangganHp);
    setEditPaymentMethod(r.paymentMethod);
    setEditDiskon(r.diskon ? String(r.diskon) : "");
    setEditPpnEnabled(r.ppnAmount > 0);
    setEditPpnPercent(r.ppnPercent ? String(r.ppnPercent) : "11");
    setEditCatatan(r.catatan || "");
    setEditCart(
      r.items.map((it, idx) => ({
        rowId: `orig-${idx}`,
        inventoriId: it.inventoriId,
        idItem: it.idItem,
        namaProduk: it.namaProduk,
        kadar: it.kadar,
        beratGram: it.beratGram,
        hargaJual: it.hargaSatuan,
        ongkos: it.ongkos,
        qty: it.qty,
      }))
    );
    setItemSearchText("");
    setEditMsg("");
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditMsg("");
  }

  function updateCartRow(rowId: string, patch: Partial<EditCartRow>) {
    setEditCart((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function removeCartRow(rowId: string) {
    setEditCart((prev) => prev.filter((row) => row.rowId !== rowId));
  }

  function addItemToCart(item: PosStockItem) {
    newRowSeq.current += 1;
    setEditCart((prev) => [
      ...prev,
      {
        rowId: `new-${newRowSeq.current}`,
        inventoriId: item.id,
        idItem: item.id_item,
        namaProduk: item.nama_produk,
        kadar: item.kadar,
        beratGram: item.berat_gram,
        hargaJual: item.harga_jual,
        ongkos: 0,
        qty: 1,
      },
    ]);
    setItemSearchText("");
  }

  function suggestItems(text: string): PosStockItem[] {
    const q = text.trim().toLowerCase();
    const pool = !q
      ? inventoriItems
      : inventoriItems.filter(
          (i) => i.nama_produk.toLowerCase().includes(q) || i.id_item.toLowerCase().includes(q)
        );
    return pool.slice(0, 8);
  }

  /** Total qty barang ini di invoice ASLI (sebelum diedit) — stok sebesar ini "milik"
   * transaksi ini & boleh dipakai ulang tanpa dianggap kekurangan stok. */
  function originalQtyForItem(inventoriId: string): number {
    return r.items.filter((it) => it.inventoriId === inventoriId).reduce((s, it) => s + it.qty, 0);
  }

  function liveJumlah(inventoriId: string): number {
    return inventoriItems.find((i) => i.id === inventoriId)?.jumlah ?? 0;
  }

  function maxQtyForRow(row: EditCartRow): number {
    if (!row.inventoriId) return 999999; // barang sudah dihapus dari inventori — tidak ada batas stok utk dicek
    const usedByOthers = editCart
      .filter((x) => x.rowId !== row.rowId && x.inventoriId === row.inventoriId)
      .reduce((s, x) => s + x.qty, 0);
    return Math.max(1, liveJumlah(row.inventoriId) + originalQtyForItem(row.inventoriId) - usedByOthers);
  }

  const editSubtotal = editCart.reduce((s, row) => s + row.hargaJual * row.qty + row.ongkos, 0);
  const editDiskonNum = parseInt(editDiskon.replace(/\D/g, "")) || 0;
  const editAfterDiskon = Math.max(0, editSubtotal - editDiskonNum);
  const editPpnPercentNum = Math.max(0, parseFloat(editPpnPercent.replace(",", ".")) || 0);
  const editPpnAmount = editPpnEnabled ? Math.round((editAfterDiskon * editPpnPercentNum) / 100) : 0;
  const editTotal = editAfterDiskon + editPpnAmount;

  async function saveEdit() {
    const nama = editPelangganNama.trim();
    if (!nama) { setEditMsg("Nama pelanggan wajib diisi."); return; }
    if (!editPaymentMethod) { setEditMsg("Pilih metode pembayaran."); return; }
    if (editCart.length === 0) { setEditMsg("Invoice harus punya minimal satu barang."); return; }
    for (const row of editCart) {
      if (row.qty < 1) { setEditMsg(`Qty "${row.namaProduk}" harus minimal 1.`); return; }
      if (row.qty > maxQtyForRow(row)) { setEditMsg(`Qty "${row.namaProduk}" melebihi stok yang tersedia.`); return; }
    }

    setSaving(true);
    setEditMsg("");

    const oldQtyByItemId = new Map<string, number>();
    for (const it of r.items) {
      if (!it.inventoriId) continue;
      oldQtyByItemId.set(it.inventoriId, (oldQtyByItemId.get(it.inventoriId) ?? 0) + it.qty);
    }
    const newQtyByItemId = new Map<string, number>();
    for (const row of editCart) {
      if (!row.inventoriId) continue;
      newQtyByItemId.set(row.inventoriId, (newQtyByItemId.get(row.inventoriId) ?? 0) + row.qty);
    }
    const allIds = new Set<string>([...oldQtyByItemId.keys(), ...newQtyByItemId.keys()]);

    // Pass 1: validasi — ambil stok terkini langsung dari DB, hitung hasil akhirnya,
    // batalkan SEBELUM menulis apa pun kalau ada yang bakal jadi negatif.
    const jumlahBaruByItemId = new Map<string, number>();
    for (const id of allIds) {
      const oldQty = oldQtyByItemId.get(id) ?? 0;
      const newQty = newQtyByItemId.get(id) ?? 0;
      const delta = newQty - oldQty;
      const { data, error } = await supabase.from("inventori").select("jumlah").eq("id", id).single();
      if (error || !data) {
        setEditMsg("Gagal membaca stok barang terkini. Coba lagi.");
        setSaving(false);
        return;
      }
      const jumlahBaru = data.jumlah - delta;
      if (jumlahBaru < 0) {
        const namaBarang =
          editCart.find((x) => x.inventoriId === id)?.namaProduk ??
          r.items.find((x) => x.inventoriId === id)?.namaProduk ??
          "barang ini";
        setEditMsg(`Stok tidak cukup untuk "${namaBarang}".`);
        setSaving(false);
        return;
      }
      jumlahBaruByItemId.set(id, jumlahBaru);
    }

    // Pass 2: tulis stok yang benar-benar berubah saja.
    const idsToUpdate = [...allIds].filter(
      (id) => (newQtyByItemId.get(id) ?? 0) !== (oldQtyByItemId.get(id) ?? 0)
    );
    const updateResults = await Promise.all(
      idsToUpdate.map((id) => {
        const jumlahBaru = jumlahBaruByItemId.get(id)!;
        return supabase
          .from("inventori")
          .update({
            jumlah: jumlahBaru,
            status_inventori: jumlahBaru <= 0 ? "Terjual" : "Tersedia",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      })
    );
    const updateError = updateResults.find((res) => res.error)?.error;
    if (updateError) {
      setEditMsg("Gagal memperbarui stok: " + updateError.message);
      setSaving(false);
      return;
    }

    const inserts = buildInventoriKeluarInserts(
      editCart.map((row) => ({
        inventoriId: row.inventoriId,
        idItem: row.idItem,
        namaProduk: row.namaProduk,
        kadar: row.kadar,
        beratGram: row.beratGram,
        hargaJual: row.hargaJual,
        ongkos: row.ongkos,
        qty: row.qty,
      })),
      {
        noInvoice: r.noInvoice,
        createdAt: r.createdAt,
        pelangganNama: nama,
        pelangganHp: editPelangganHp.trim() || null,
        paymentMethod: editPaymentMethod,
        catatan: editCatatan.trim() || null,
        diskon: editDiskonNum,
        ppnEnabled: editPpnEnabled,
        ppnPercent: editPpnPercentNum,
        ppnAmount: editPpnAmount,
        total: editTotal,
        jumlahSisaByItemId: jumlahBaruByItemId,
      }
    );

    const { error: deleteError } = await supabase.from("inventori_keluar").delete().eq("no_invoice", r.noInvoice);
    if (deleteError) {
      setEditMsg("Stok sudah disesuaikan, tapi gagal menghapus baris lama: " + deleteError.message);
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("inventori_keluar").insert(inserts);
    if (insertError) {
      setEditMsg("Stok sudah disesuaikan & baris lama terhapus, tapi gagal menyimpan baris baru: " + insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditMode(false);
    onSaved();
  }

  async function confirmDelete() {
    setDeleting(true);

    const oldQtyByItemId = new Map<string, number>();
    for (const it of r.items) {
      if (!it.inventoriId) continue;
      oldQtyByItemId.set(it.inventoriId, (oldQtyByItemId.get(it.inventoriId) ?? 0) + it.qty);
    }

    for (const [id, qty] of oldQtyByItemId) {
      const { data, error } = await supabase.from("inventori").select("jumlah").eq("id", id).single();
      if (error || !data) continue; // barang sudah dihapus dari inventori — tidak ada stok utk dikembalikan
      const jumlahBaru = data.jumlah + qty;
      await supabase
        .from("inventori")
        .update({ jumlah: jumlahBaru, status_inventori: "Tersedia", updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    const { error } = await supabase.from("inventori_keluar").delete().eq("no_invoice", r.noInvoice);
    setDeleting(false);
    if (error) {
      alert("Gagal menghapus invoice: " + error.message);
      return;
    }
    setShowDeleteConfirm(false);
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{editMode ? "Edit Transaksi" : "Detail Transaksi"}</h2>
            <p className="text-xs text-gray-400 font-mono">{r.noInvoice}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
          >
            ×
          </button>
        </div>

        {!editMode && (
          <>
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
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  Barang yang Dibeli ({r.items.length} jenis · {r.totalQty} pcs)
                </h3>
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
                            <div className="flex items-center gap-2.5">
                              {it.gambarUrl ? (
                                <StorageImage
                                  src={it.gambarUrl}
                                  alt={it.namaProduk}
                                  className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-800">{it.namaProduk}</p>
                                <p className="text-xs text-gray-400">
                                  {it.idItem}
                                  {it.kadar ? ` · ${it.kadar}` : ""}
                                  {it.beratGram ? ` · ${fmtGram(it.beratGram)}` : ""}
                                </p>
                              </div>
                            </div>
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
                {r.items.some((it) => it.beratGram > 0) && (
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    Total berat: <span className="font-semibold">{fmtGram(r.items.reduce((s, it) => s + it.beratGram * it.qty, 0))}</span>
                  </p>
                )}
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
                      <span className="text-gray-500">PPN{r.ppnPercent ? ` (${r.ppnPercent}%)` : ""}</span>
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

            <div className="px-6 pb-6 grid grid-cols-4 gap-2">
              <button
                onClick={onClose}
                className="py-3 rounded-xl border-2 font-bold hover:bg-gray-50 transition-colors"
                style={{ borderColor: "#6F5333", color: "#6F5333" }}
              >
                Tutup
              </button>
              <button
                onClick={openEdit}
                className="py-3 rounded-xl border-2 border-amber-400 text-amber-600 font-bold hover:bg-amber-50 transition-colors"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="py-3 rounded-xl border-2 border-red-300 text-red-500 font-bold hover:bg-red-50 transition-colors"
              >
                🗑️ Hapus
              </button>
              <button
                onClick={onPrint}
                className="py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                style={{ backgroundColor: "#6F5333" }}
              >
                🖨️ Cetak
              </button>
            </div>
          </>
        )}

        {editMode && (
          <>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Pelanggan</label>
                  <input
                    type="text"
                    value={editPelangganNama}
                    onChange={(e) => setEditPelangganNama(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">No. Telepon</label>
                  <input
                    type="text"
                    value={editPelangganHp}
                    onChange={(e) => setEditPelangganHp(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Metode Pembayaran</label>
                <div className="grid grid-cols-4 gap-2 max-w-sm">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditPaymentMethod(m)}
                      className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                        editPaymentMethod === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}
                      style={editPaymentMethod === m ? { backgroundColor: "#6F5333" } : {}}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barang */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Barang</label>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-semibold">Barang</th>
                        <th className="text-right px-2 py-2 font-semibold">Harga Satuan</th>
                        <th className="text-right px-2 py-2 font-semibold">Ongkos</th>
                        <th className="text-center px-2 py-2 font-semibold">Qty</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {editCart.map((row) => (
                        <tr key={row.rowId} className="border-t border-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-gray-800">{row.namaProduk}</p>
                            <p className="text-xs text-gray-400">
                              {row.kadar}
                              {row.beratGram ? ` · ${fmtGram(row.beratGram)}` : ""}
                              {!row.inventoriId && " · barang sudah dihapus dari inventori"}
                            </p>
                          </td>
                          <td className="px-2 py-2 min-w-[110px]">
                            <RpField value={row.hargaJual} onChange={(v) => updateCartRow(row.rowId, { hargaJual: v })} />
                          </td>
                          <td className="px-2 py-2 min-w-[100px]">
                            <RpField value={row.ongkos} onChange={(v) => updateCartRow(row.rowId, { ongkos: v })} />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              max={maxQtyForRow(row)}
                              value={row.qty}
                              onChange={(e) =>
                                updateCartRow(row.rowId, {
                                  qty: Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQtyForRow(row))),
                                })
                              }
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C99A36]"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button type="button" onClick={() => removeCartRow(row.rowId)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-dashed border-gray-200">
                    <AutocompleteField<PosStockItem>
                      value={itemSearchText}
                      onChange={setItemSearchText}
                      onSelect={addItemToCart}
                      suggestions={suggestItems(itemSearchText)}
                      renderLabel={(i) => i.nama_produk}
                      renderSub={(i) => `${i.id_item} · ${i.kadar} · Stok ${i.jumlah}`}
                      placeholder="+ Tambah barang — cari kode/nama..."
                      noResultsText="Barang tidak ditemukan atau stok habis."
                      onFocus={() => {}}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 space-y-2 text-sm bg-amber-50/40">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{fmtRp(editSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Diskon (Rp)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editDiskon ? Number(editDiskon).toLocaleString("id-ID") : ""}
                    onChange={(e) => setEditDiskon(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-gray-600 select-none cursor-pointer">
                    <input type="checkbox" checked={editPpnEnabled} onChange={(e) => setEditPpnEnabled(e.target.checked)} className="accent-[#C99A36]" />
                    PPN
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPpnPercent}
                      onChange={(e) => setEditPpnPercent(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="w-16 border border-gray-200 rounded-lg px-1.5 py-1 text-right text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                    <span className="text-gray-500">% = {fmtRp(editPpnAmount)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL</span>
                  <span style={{ color: "#6F5333" }}>{fmtRp(editTotal)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Catatan</label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36] resize-none"
                />
              </div>

              {editMsg && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editMsg}</p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border-2 font-bold hover:bg-gray-50 disabled:opacity-40 transition-colors"
                style={{ borderColor: "#6F5333", color: "#6F5333" }}
              >
                Batal
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: "#6F5333" }}
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Hapus Invoice Ini?"
        message={
          <>
            Invoice <strong>{r.noInvoice}</strong> akan dihapus permanen & stok barangnya
            dikembalikan ke inventori. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
