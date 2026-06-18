"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { printClean } from "@/lib/print";

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
interface InvItem {
  id: string;
  id_item: string;
  nama_produk: string;
  kategori: string;
  kadar: string;
  berat_gram: number;
  jumlah: number;
  harga_beli: number;
  harga_jual: number;
  gambar_url?: string;
  jenis_inventori?: string;
}

interface CartItem {
  item: InvItem;
  qty: number;
  hargaJual: number;
  ongkos: number;
}

interface Pelanggan {
  id: string;
  nama: string;
  telepon: string | null;
  alamat?: string | null;
}

interface DraftRow {
  id: string;
  item: InvItem | null;
  codeText: string;
  nameText: string;
  hargaJual: number;
  ongkos: number;
  qty: number;
}

interface RiwayatTransaksi {
  noInvoice: string;
  pelangganNama: string;
  paymentMethod: string;
  createdAt: string;
  items: string[];
  totalQty: number;
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const fmtGram = (n: number) => (n || 0).toFixed(2) + " gr";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function terbilang(angka: number): string {
  const satuan = [
    "", "satu", "dua", "tiga", "empat", "lima",
    "enam", "tujuh", "delapan", "sembilan", "sepuluh",
    "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas",
    "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
  ];
  if (angka === 0) return "nol";
  if (angka < 0) return "minus " + terbilang(-angka);
  let r = "";
  if (angka >= 1_000_000_000) { r += terbilang(Math.floor(angka / 1_000_000_000)) + " miliar "; angka %= 1_000_000_000; }
  if (angka >= 1_000_000)     { r += terbilang(Math.floor(angka / 1_000_000))     + " juta ";   angka %= 1_000_000; }
  if (angka >= 1_000) {
    const rb = Math.floor(angka / 1_000);
    r += (rb === 1 ? "se" : terbilang(rb) + " ") + "ribu ";
    angka %= 1_000;
  }
  if (angka >= 100) {
    const rt = Math.floor(angka / 100);
    r += (rt === 1 ? "se" : terbilang(rt) + " ") + "ratus ";
    angka %= 100;
  }
  if (angka > 0) {
    if (angka < 20) r += satuan[angka];
    else {
      r += satuan[Math.floor(angka / 10)] + " puluh";
      if (angka % 10 > 0) r += " " + satuan[angka % 10];
    }
  }
  return r.trim();
}

function genNoInvoice(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ms = String(Date.now()).slice(-4);
  return `INV-${y}${m}${d}-${ms}`;
}

function fmtTanggalInv(d: Date) {
  return (
    String(d.getDate()).padStart(2, "0") + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    d.getFullYear()
  );
}

function fmtWaktuRiwayat(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

let rowSeq = 0;
function makeRow(): DraftRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, item: null, codeText: "", nameText: "", hargaJual: 0, ongkos: 0, qty: 1 };
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: INPUT AUTOCOMPLETE (dipakai utk barang & pelanggan)
═══════════════════════════════════════════════════════ */
interface AutocompleteFieldProps<T> {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: T) => void;
  suggestions: T[];
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => string;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
}

function AutocompleteField<T>({
  value, onChange, onSelect, suggestions, renderLabel, renderSub, placeholder, inputClassName, disabled,
}: AutocompleteFieldProps<T>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={inputClassName || "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <p className="text-sm font-semibold text-gray-800">{renderLabel(s)}</p>
              {renderSub && <p className="text-xs text-gray-400">{renderSub(s)}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── No. telepon disimpan sebagai nomor lokal (tanpa 0 / 62 di depan) ───
   Prefix +62 ditambahkan otomatis saat ditampilkan / disimpan. */
function localPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 13);
}

function toFullPhone(local: string): string {
  return local ? `+62${local}` : "";
}

/* ─── Input no. telepon dengan prefix +62 otomatis ─── */
function PhoneField({
  value, onChange, placeholder, className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#C99A36] bg-white ${className || ""}`}>
      <span className="px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0">+62</span>
      <input
        type="tel"
        inputMode="numeric"
        placeholder={placeholder || "8123456789"}
        value={value}
        onChange={(e) => onChange(localPhoneDigits(e.target.value))}
        className="flex-1 px-3 py-2.5 text-sm focus:outline-none min-w-0"
      />
    </div>
  );
}

/* ─── Input harga format Rp ─── */
function RpField({
  value, onChange, disabled = false, className = "",
}: { value: number; onChange: (v: number) => void; disabled?: boolean; className?: string }) {
  const formatted = value > 0 ? value.toLocaleString("id-ID") : "";
  return (
    <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#C99A36] bg-white ${disabled ? "opacity-50" : ""} ${className}`}>
      <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 select-none shrink-0">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={formatted}
        onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder="0"
        className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0 disabled:bg-gray-50"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: INVOICE (dipakai utk cetak & preview)
═══════════════════════════════════════════════════════ */
interface InvoiceProps {
  mode: "print" | "preview";
  noInvoice: string;
  tanggal: string;
  pelangganNama: string;
  pelangganHP: string;
  cart: CartItem[];
  diskon: number;
  subtotal: number;
  total: number;
  totalBerat: number;
  paymentMethod: string;
  ppnEnabled: boolean;
  ppnPercent: number;
  ppnAmount: number;
}

function InvoiceCetak(p: InvoiceProps) {
  const GOLD = "#8B6914";
  const GOLD_LT = "#D4A853";
  const terbilangText = terbilang(p.total) + " rupiah";
  const MIN_ROWS = 4;
  const emptyRows = Math.max(0, MIN_ROWS - p.cart.length);
  const isPrint = p.mode === "print";

  return (
    <div
      id={isPrint ? "invoice-print" : undefined}
      style={{
        display: isPrint ? "none" : "block",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "8pt",
        color: "#111",
        lineHeight: "1.3",
        backgroundColor: "#fff",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8pt",
        borderBottom: `2pt solid ${GOLD}`,
        paddingBottom: "6pt",
        marginBottom: "6pt",
      }}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-kresno.png"
          alt="Logo"
          style={{ width: "48pt", height: "48pt", objectFit: "contain", flexShrink: 0 }}
        />

        {/* Nama & Info Toko */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            fontSize: "15pt", fontWeight: 900, color: GOLD,
            fontFamily: "Georgia, serif", letterSpacing: "0.04em",
          }}>
            TOKOMAS KRESNO
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6pt", margin: "1pt 0 2pt" }}>
            <div style={{ height: "1pt", width: "44pt", backgroundColor: GOLD_LT }} />
            <div style={{ width: "4pt", height: "4pt", backgroundColor: GOLD_LT, transform: "rotate(45deg)" }} />
            <div style={{ height: "1pt", width: "44pt", backgroundColor: GOLD_LT }} />
          </div>
          <div style={{ fontSize: "6.5pt", color: "#444" }}>
            Jl. Kios Pasar Grabag Petak Blok KA No. 7A-7B
          </div>
          <div style={{ fontSize: "6.5pt", color: "#444" }}>
            (Depan Terminal Lama), Grabag, Magelang, Jawa Tengah
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "12pt", marginTop: "2pt", fontSize: "6.5pt", color: "#444" }}>
            <span>☎ 0821-8501-3553</span>
            <span>|</span>
            <span>✉ tokomaskresno5758@gmail.com</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "12pt", fontSize: "6.5pt", color: "#444" }}>
            <span>📷 tokomaskresno.grabag</span>
            <span>|</span>
            <span>🎵 Tk. Mas Kresno Grabag</span>
          </div>
        </div>

        {/* No Invoice & Tanggal */}
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: "85pt" }}>
          <div style={{ fontWeight: 900, fontSize: "8.5pt", color: "#111", letterSpacing: "0.02em" }}>
            NOTA / INVOICE
          </div>
          <div style={{ fontWeight: 900, fontSize: "11pt", color: "#DC2626", marginTop: "2pt" }}>
            {p.noInvoice}
          </div>
          <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2pt" }}>
            Tanggal : {p.tanggal}
          </div>
          <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "1pt", fontWeight: 700 }}>
            {p.paymentMethod}
          </div>
        </div>
      </div>

      {/* ── INFO PELANGGAN ── */}
      <div style={{ display: "flex", gap: "20pt", marginBottom: "6pt", fontSize: "8pt" }}>
        <div style={{ flex: 1 }}>
          Nama Pelanggan :{" "}
          <span style={{ borderBottom: "0.75pt solid #000", display: "inline-block", minWidth: "170pt", paddingRight: "6pt" }}>
            {p.pelangganNama}
          </span>
        </div>
        <div>
          No. HP :{" "}
          <span style={{ borderBottom: "0.75pt solid #000", display: "inline-block", minWidth: "95pt" }}>
            {p.pelangganHP}
          </span>
        </div>
      </div>

      {/* ── FOTO + TABEL BARANG ── */}
      <div style={{ display: "flex", gap: "8pt", marginBottom: "6pt" }}>
        {/* Foto barang */}
        <div style={{
          width: "70pt", flexShrink: 0,
          border: `1.5pt solid ${GOLD}`, borderRadius: "4pt",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          backgroundColor: "#FAFAF7",
        }}>
          {p.cart.length > 0 && p.cart[0].item.gambar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.cart[0].item.gambar_url}
              alt="Foto Barang"
              style={{ width: "62pt", height: "62pt", objectFit: "cover", borderRadius: "3pt" }}
            />
          ) : (
            <>
              <div style={{ fontSize: "18pt", color: "#ccc" }}>📷</div>
              <div style={{ fontSize: "6pt", color: "#aaa", marginTop: "3pt" }}>4 x 4 cm</div>
            </>
          )}
        </div>

        {/* Tabel item */}
        <table style={{ flex: 1, borderCollapse: "collapse", fontSize: "8pt" }}>
          <thead>
            <tr style={{ backgroundColor: GOLD, color: "#fff" }}>
              {[
                { label: "No",         w: "22pt",  align: "center" as const },
                { label: "Nama Barang", w: "",      align: "left"   as const },
                { label: "Kadar",       w: "38pt",  align: "center" as const },
                { label: "Berat",       w: "48pt",  align: "center" as const },
                { label: "Harga/Gram",  w: "65pt",  align: "right"  as const },
                { label: "Ongkos",      w: "55pt",  align: "right"  as const },
                { label: "Total",       w: "65pt",  align: "right"  as const },
              ].map((h) => (
                <th key={h.label} style={{
                  padding: "3pt 5pt",
                  border: `0.5pt solid ${GOLD}`,
                  fontWeight: 700,
                  textAlign: h.align,
                  width: h.w || undefined,
                  whiteSpace: "nowrap",
                }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.cart.map((ci, idx) => {
              const hargaPerGram = ci.item.berat_gram > 0
                ? Math.round(ci.hargaJual / ci.item.berat_gram) : 0;
              const totalItem = ci.hargaJual * ci.qty + ci.ongkos;
              return (
                <tr key={ci.item.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#FFFDF5" }}>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}` }}>
                    {ci.item.nama_produk}{ci.qty > 1 ? ` (×${ci.qty})` : ""}
                  </td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{ci.item.kadar}</td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{fmtGram(ci.item.berat_gram * ci.qty)}</td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right" }}>{fmtRp(hargaPerGram)}</td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right" }}>{ci.ongkos > 0 ? fmtRp(ci.ongkos) : "-"}</td>
                  <td style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right", fontWeight: 700 }}>{fmtRp(totalItem)}</td>
                </tr>
              );
            })}
            {/* Baris kosong pengisi */}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={"emp-" + i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#FFFDF5" }}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} style={{ padding: "3pt 5pt", border: `0.5pt solid ${GOLD_LT}` }}>&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTAL BERAT + RINGKASAN HARGA ── */}
      <div style={{ display: "flex", gap: "10pt", marginBottom: "6pt" }}>
        {/* Kiri: berat & terbilang */}
        <div style={{
          flex: 1, border: `1pt solid ${GOLD_LT}`,
          borderRadius: "4pt", padding: "5pt 10pt", fontSize: "8pt",
        }}>
          <div style={{ display: "flex", gap: "4pt", alignItems: "center", marginBottom: "4pt" }}>
            <span style={{ minWidth: "68pt", fontWeight: 600 }}>Total Berat</span>
            <span>:</span>
            <span style={{ borderBottom: "0.75pt solid #000", flex: 1, paddingRight: "4pt" }}>
              {fmtGram(p.totalBerat)}
            </span>
            <span>gram</span>
          </div>
          <div style={{ display: "flex", gap: "4pt", alignItems: "flex-start" }}>
            <span style={{ minWidth: "68pt", fontWeight: 600 }}>Terbilang</span>
            <span>:</span>
            <span style={{
              borderBottom: "0.75pt solid #000", flex: 1,
              textTransform: "capitalize", lineHeight: "1.4",
            }}>
              {terbilangText}
            </span>
          </div>
        </div>

        {/* Kanan: subtotal/diskon/total */}
        <div style={{
          minWidth: "175pt", border: `1pt solid ${GOLD_LT}`,
          borderRadius: "4pt", overflow: "hidden", fontSize: "8pt",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3pt 10pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
            <span>Subtotal</span>
            <span>: {fmtRp(p.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3pt 10pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
            <span>Diskon</span>
            <span>: {fmtRp(p.diskon)}</span>
          </div>
          {p.ppnEnabled && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3pt 10pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
              <span>PPN ({p.ppnPercent}%)</span>
              <span>: {fmtRp(p.ppnAmount)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "4pt 10pt", backgroundColor: GOLD,
            color: "#fff", fontWeight: 900, fontSize: "9pt",
          }}>
            <span>TOTAL</span>
            <span>: {fmtRp(p.total)}</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER: KETENTUAN + TANDA TANGAN ── */}
      <div style={{
        display: "flex", gap: "20pt",
        paddingTop: "5pt", borderTop: `1pt dashed ${GOLD}`,
        fontSize: "7pt", marginTop: "2pt",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: "8pt", marginBottom: "3pt" }}>KETENTUAN :</div>
          <ul style={{ margin: 0, paddingLeft: "12pt", lineHeight: "1.45" }}>
            <li>Barang, kadar, dan berat telah diperiksa serta disetujui oleh pembeli.</li>
            <li>Perhiasan emas dapat dijual kembali sesuai harga pasaran toko yang berlaku dengan memperhitungkan kondisi barang dan potongan ongkos.</li>
            <li>Perhiasan yang mengandung batu, patri, atau mengalami kerusakan akan dinilai dengan harga yang berbeda.</li>
          </ul>
        </div>
        <div style={{ minWidth: "110pt", textAlign: "right" }}>
          <div>Hormat kami,</div>
          <div style={{ marginTop: "20pt", borderTop: "0.75pt solid #000", paddingTop: "2pt", textAlign: "center" }}>
            (.................................)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HALAMAN UTAMA POS
═══════════════════════════════════════════════════════ */
export default function POSPage() {
  const supabase = createClient();

  const [items, setItems] = useState<InvItem[]>([]);
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([makeRow()]);
  const [pelangganNama, setPelangganNama] = useState("");
  const [pelangganHP, setPelangganHP] = useState("");
  const [tanggalPembelian, setTanggalPembelian] = useState(todayStr());
  const [diskon, setDiskon] = useState("");
  const [ppnEnabled, setPpnEnabled] = useState(false);
  const [ppnPercent, setPpnPercent] = useState("11");
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "Transfer" | "QRIS" | "">("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBuatInvoiceModal, setShowBuatInvoiceModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pendingInvoiceNo, setPendingInvoiceNo] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [invoiceReady, setInvoiceReady] = useState<{ noInvoice: string; tanggal: string } | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatTransaksi[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);

  /* ── Load inventori tersedia + daftar pelanggan ── */
  async function loadItems() {
    const { data } = await supabase
      .from("inventori")
      .select("*")
      .eq("status_inventori", "Tersedia")
      .gt("jumlah", 0)
      .order("nama_produk");
    setItems((data ?? []) as InvItem[]);
    setLoading(false);
  }

  /* ── Load riwayat transaksi POS terakhir (dikelompokkan per no. invoice) ── */
  async function loadRiwayat() {
    setLoadingRiwayat(true);
    const { data } = await supabase
      .from("inventori_keluar")
      .select("nama_produk, jumlah_keluar, catatan, created_at")
      .like("catatan", "INV-%")
      .order("created_at", { ascending: false })
      .limit(40);

    const grouped: RiwayatTransaksi[] = [];
    const seen = new Map<string, RiwayatTransaksi>();
    for (const row of data ?? []) {
      const parts = ((row.catatan as string) || "").split(" | ");
      const noInvoice = parts[0] || "-";
      let entry = seen.get(noInvoice);
      if (!entry) {
        entry = {
          noInvoice,
          pelangganNama: parts[1] || "Umum",
          paymentMethod: parts[2] || "",
          createdAt: row.created_at as string,
          items: [],
          totalQty: 0,
        };
        seen.set(noInvoice, entry);
        grouped.push(entry);
      }
      entry.items.push(row.nama_produk as string);
      entry.totalQty += (row.jumlah_keluar as number) || 0;
      if (grouped.length >= 6) break;
    }
    setRiwayat(grouped);
    setLoadingRiwayat(false);
  }

  useEffect(() => {
    loadItems();
    loadRiwayat();
    supabase.from("pelanggan").select("*").order("nama").then(({ data }) => {
      setPelangganList((data ?? []) as Pelanggan[]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Buka modal "Buat Invoice Baru" + siapkan No. Invoice ── */
  function openBuatInvoiceModal() {
    if (!canPreview) return;
    if (!pendingInvoiceNo) {
      setPendingInvoiceNo(genNoInvoice());
      setInvoiceDate(tanggalPembelian || todayStr());
    }
    setShowBuatInvoiceModal(true);
  }

  /* ── Row helpers ── */
  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function selectItemForRow(id: string, item: InvItem) {
    updateRow(id, {
      item,
      codeText: item.id_item,
      nameText: item.nama_produk,
      hargaJual: item.harga_jual,
      ongkos: 0,
      qty: 1,
    });
  }

  function setCodeText(id: string, val: string) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const stillMatches = r.item ? r.item.id_item === val : false;
      return { ...r, codeText: val, item: stillMatches ? r.item : null };
    }));
  }

  function setNameText(id: string, val: string) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const stillMatches = r.item ? r.item.nama_produk === val : false;
      return { ...r, nameText: val, item: stillMatches ? r.item : null };
    }));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length === 1 ? [makeRow()] : prev.filter((r) => r.id !== id)));
  }

  function maxQtyFor(rowId: string, item: InvItem): number {
    const usedByOthers = rows
      .filter((r) => r.id !== rowId && r.item?.id === item.id)
      .reduce((s, r) => s + r.qty, 0);
    return Math.max(1, item.jumlah - usedByOthers);
  }

  function rowMaxQty(row: DraftRow): number {
    return row.item ? maxQtyFor(row.id, row.item) : 1;
  }

  function suggestByCode(text: string): InvItem[] {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.id_item.toLowerCase().includes(q)).slice(0, 6);
  }

  function suggestByName(text: string): InvItem[] {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.nama_produk.toLowerCase().includes(q)).slice(0, 6);
  }

  function suggestPelanggan(text: string): Pelanggan[] {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return pelangganList.filter((p) => p.nama.toLowerCase().includes(q)).slice(0, 6);
  }

  function pilihPelanggan(p: Pelanggan) {
    setPelangganNama(p.nama);
    setPelangganHP(localPhoneDigits(p.telepon ?? ""));
  }

  /* ── Derived ── */
  const validRows = rows.filter((r): r is DraftRow & { item: InvItem } => r.item !== null);
  const subtotal = validRows.reduce((s, r) => s + r.hargaJual * r.qty + r.ongkos, 0);
  const diskonNum = parseInt(diskon.replace(/\D/g, "")) || 0;
  const afterDiskon = Math.max(0, subtotal - diskonNum);
  const ppnPercentNum = Math.max(0, parseFloat(ppnPercent.replace(",", ".")) || 0);
  const ppnAmount = ppnEnabled ? Math.round(afterDiskon * ppnPercentNum / 100) : 0;
  const total = afterDiskon + ppnAmount;
  const totalBerat = validRows.reduce((s, r) => s + r.item.berat_gram * r.qty, 0);
  const canPreview = validRows.length > 0;
  const cartForInvoice: CartItem[] = validRows.map((r) => ({ item: r.item, qty: r.qty, hargaJual: r.hargaJual, ongkos: r.ongkos }));

  /* ── Simpan transaksi & cetak ── */
  async function simpanInvoice() {
    if (validRows.length === 0 || !paymentMethod) return;
    if (!pelangganNama.trim()) {
      alert("Nama pelanggan wajib diisi.");
      return;
    }
    setSaving(true);

    const noInvoice = pendingInvoiceNo || genNoInvoice();
    const tanggal = fmtTanggalInv(invoiceDate ? new Date(invoiceDate) : new Date());

    // Simpan pelanggan baru otomatis jika namanya belum ada di daftar
    const existingPelanggan = pelangganList.find(
      (p) => p.nama.trim().toLowerCase() === pelangganNama.trim().toLowerCase()
    );
    if (!existingPelanggan && pelangganNama.trim()) {
      const { data } = await supabase
        .from("pelanggan")
        .insert({ nama: pelangganNama.trim(), telepon: toFullPhone(pelangganHP) || null })
        .select()
        .single();
      if (data) setPelangganList((prev) => [...prev, data as Pelanggan]);
    }

    const catatanGabungan = [noInvoice, pelangganNama.trim() || "Umum", paymentMethod, catatan.trim()]
      .filter(Boolean)
      .join(" | ");

    const inserts = validRows.map((r) => ({
      inventori_id: r.item.id,
      id_item: r.item.id_item,
      nama_produk: r.item.nama_produk,
      jumlah_keluar: r.qty,
      status_baru: "Terjual",
      catatan: catatanGabungan,
    }));

    const { error } = await supabase.from("inventori_keluar").insert(inserts);

    if (error) {
      alert("Gagal menyimpan transaksi: " + error.message);
      setSaving(false);
      return;
    }

    setInvoiceReady({ noInvoice, tanggal });
    setSaving(false);
    setShowBuatInvoiceModal(false);
    setShowPreviewModal(true);
    loadRiwayat();
  }

  /* ── Reset form (belum transaksi) ── */
  function resetForm() {
    setRows([makeRow()]);
    setPelangganNama("");
    setPelangganHP("");
    setTanggalPembelian(todayStr());
    setDiskon("");
    setPpnEnabled(false);
    setPpnPercent("11");
    setPaymentMethod("");
    setCatatan("");
  }

  /* ── Mulai transaksi baru setelah selesai ── */
  function transaksiBerikutnya() {
    setRows([makeRow()]);
    setPelangganNama("");
    setPelangganHP("");
    setTanggalPembelian(todayStr());
    setPaymentMethod("");
    setDiskon("");
    setCatatan("");
    setPpnEnabled(false);
    setPpnPercent("11");
    setInvoiceReady(null);
    setPendingInvoiceNo(null);
    setShowPreviewModal(false);
    setLoading(true);
    loadItems();
  }

  /* ── Render ── */
  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, nav, #pos-screen, #preview-modal-overlay, #buat-invoice-modal-overlay { display: none !important; }
          #invoice-print { display: block !important; }
          html, body { background: white !important; margin: 0; }
          @page { size: A5 landscape; margin: 10mm; }
        }
      `}</style>

      {/* Invoice — hidden on screen, visible on print */}
      {invoiceReady && (
        <InvoiceCetak
          mode="print"
          noInvoice={invoiceReady.noInvoice}
          tanggal={invoiceReady.tanggal}
          pelangganNama={pelangganNama}
          pelangganHP={toFullPhone(pelangganHP)}
          cart={cartForInvoice}
          diskon={diskonNum}
          subtotal={subtotal}
          total={total}
          totalBerat={totalBerat}
          paymentMethod={paymentMethod}
          ppnEnabled={ppnEnabled}
          ppnPercent={ppnPercentNum}
          ppnAmount={ppnAmount}
        />
      )}

      <AppLayout title="Point of Sale" subtitle="Transaksi penjualan ke customer">
        <div id="pos-screen" className="max-w-7xl mx-auto w-full space-y-5 px-4 sm:px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Point of Sales</h1>
            <p className="text-sm text-gray-500 mt-0.5">Catat transaksi penjualan barang ke pelanggan.</p>
          </div>

          {invoiceReady ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-3">
              <p className="text-4xl">✅</p>
              <p className="text-lg font-bold text-gray-800">Transaksi berhasil disimpan!</p>
              <p className="text-sm text-gray-500">
                No. Invoice: <span className="font-mono font-semibold">{invoiceReady.noInvoice}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="px-6 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#6F5333" }}
                >
                  🖨️ Lihat / Cetak Ulang Invoice
                </button>
                <button
                  onClick={transaksiBerikutnya}
                  className="px-6 py-3 rounded-xl border-2 font-bold hover:bg-gray-50 transition-all"
                  style={{ borderColor: "#6F5333", color: "#6F5333" }}
                >
                  + Transaksi Baru
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Data Customer */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1 h-5 rounded-full" style={{ backgroundColor: "#C99A36" }} />
                  <h3 className="font-bold text-gray-800">Data Customer</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Customer</label>
                    <AutocompleteField
                      value={pelangganNama}
                      onChange={setPelangganNama}
                      onSelect={pilihPelanggan}
                      suggestions={suggestPelanggan(pelangganNama)}
                      renderLabel={(p) => p.nama}
                      renderSub={(p) => p.telepon ?? ""}
                      placeholder="Ketik atau pilih nama customer"
                      inputClassName="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">No. Telepon</label>
                    <PhoneField
                      value={pelangganHP}
                      onChange={setPelangganHP}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Tanggal Pembelian</label>
                    <input
                      type="date"
                      value={tanggalPembelian}
                      onChange={(e) => setTanggalPembelian(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                </div>
              </div>

              {/* Detail Barang */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <span className="w-1 h-5 rounded-full" style={{ backgroundColor: "#C99A36" }} />
                  <h3 className="font-bold text-gray-800">Detail Barang</h3>
                  {loading && <span className="text-xs text-gray-400">(memuat stok...)</span>}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-2 font-semibold">Kode Barang</th>
                        <th className="text-left px-3 py-2 font-semibold">Nama Barang</th>
                        <th className="text-left px-3 py-2 font-semibold w-36">Harga Satuan</th>
                        <th className="text-left px-3 py-2 font-semibold w-20">Jumlah</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-50">
                          <td className="px-5 py-2.5 min-w-[120px]">
                            <AutocompleteField
                              value={row.codeText}
                              onChange={(v) => setCodeText(row.id, v)}
                              onSelect={(it: InvItem) => selectItemForRow(row.id, it)}
                              suggestions={suggestByCode(row.codeText)}
                              renderLabel={(it) => it.id_item}
                              renderSub={(it) => it.nama_produk}
                              placeholder="KS-001"
                            />
                          </td>
                          <td className="px-3 py-2.5 min-w-[160px]">
                            <AutocompleteField
                              value={row.nameText}
                              onChange={(v) => setNameText(row.id, v)}
                              onSelect={(it: InvItem) => selectItemForRow(row.id, it)}
                              suggestions={suggestByName(row.nameText)}
                              renderLabel={(it) => it.nama_produk}
                              renderSub={(it) => `${it.id_item} · ${it.kadar} · Stok ${it.jumlah}`}
                              placeholder="Nama barang..."
                            />
                          </td>
                          <td className="px-3 py-2.5 min-w-[120px]">
                            <RpField disabled={!row.item} value={row.hargaJual} onChange={(v) => updateRow(row.id, { hargaJual: v })} />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              disabled={!row.item}
                              max={rowMaxQty(row)}
                              value={row.qty}
                              onChange={(e) => updateRow(row.id, { qty: Math.max(1, Math.min(parseInt(e.target.value) || 1, rowMaxQty(row))) })}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button type="button" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  className="w-full text-center py-3 text-sm font-semibold border-t border-dashed border-gray-200 hover:bg-amber-50 transition-colors"
                  style={{ color: "#6F5333" }}
                >
                  + Tambah Barang
                </button>

                {/* Summary */}
                <div className="px-5 py-4 border-t border-gray-100 space-y-2 bg-amber-50/50">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">{fmtRp(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-1.5 text-gray-600 select-none cursor-pointer">
                      <input type="checkbox" checked={ppnEnabled} onChange={(e) => setPpnEnabled(e.target.checked)} className="accent-[#C99A36]" />
                      PPN
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        disabled={!ppnEnabled}
                        value={ppnPercent}
                        onChange={(e) => setPpnPercent(e.target.value.replace(/[^0-9.,]/g, ""))}
                        className="w-12 border border-gray-200 rounded-lg px-1.5 py-1 text-right text-sm focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"
                      />
                      <span className="text-gray-500">% = {fmtRp(ppnAmount)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>TOTAL</span>
                    <span style={{ color: "#6F5333" }}>{fmtRp(total)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-xl border-2 font-bold transition-all hover:bg-gray-50"
                  style={{ borderColor: "#6F5333", color: "#6F5333" }}
                >
                  ↻ Reset Form
                </button>
                <button
                  type="button"
                  onClick={openBuatInvoiceModal}
                  disabled={!canPreview}
                  className="px-6 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  style={{ backgroundColor: "#6F5333" }}
                >
                  👁 Preview Invoice
                </button>
              </div>
            </>
          )}

          {/* Riwayat Transaksi Terakhir */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 rounded-full" style={{ backgroundColor: "#C99A36" }} />
              <h3 className="font-bold text-gray-800">Riwayat Transaksi Terakhir</h3>
            </div>
            {loadingRiwayat ? (
              <p className="text-sm text-gray-400">Memuat riwayat...</p>
            ) : riwayat.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada transaksi.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {riwayat.map((r) => (
                  <div key={r.noInvoice} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {r.pelangganNama} <span className="text-gray-400 font-normal">· {r.noInvoice}</span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {r.items.join(", ")} {r.paymentMethod && `· ${r.paymentMethod}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{fmtWaktuRiwayat(r.createdAt)}</p>
                      <p className="text-xs font-semibold" style={{ color: "#6F5333" }}>{r.totalQty} pcs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>

      {/* ══════════════════════════════════
          MODAL: BUAT INVOICE BARU
      ══════════════════════════════════ */}
      {showBuatInvoiceModal && (
        <div id="buat-invoice-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 flex flex-wrap items-start justify-between gap-4 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Buat Invoice Baru</h2>
                <p className="text-xs text-gray-400">Point of Sale</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">No. Invoice</p>
                  <p className="font-mono font-bold" style={{ color: "#6F5333" }}>{pendingInvoiceNo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Tanggal Invoice</p>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowBuatInvoiceModal(false)}
                  className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold shrink-0"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Data Customer */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Data Customer</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AutocompleteField
                    value={pelangganNama}
                    onChange={setPelangganNama}
                    onSelect={pilihPelanggan}
                    suggestions={suggestPelanggan(pelangganNama)}
                    renderLabel={(p) => p.nama}
                    renderSub={(p) => p.telepon ?? ""}
                    placeholder="Pilih atau ketik nama pelanggan"
                    inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36]"
                  />
                  <PhoneField
                    value={pelangganHP}
                    onChange={setPelangganHP}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Detail Pembelian */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Detail Pembelian</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {["#", "Kode", "Nama Barang", "Kadar", "Berat", "Harga/gram", "Ongkos", "Qty", "Total", "Aksi"].map((h) => (
                            <th key={h} className="text-left px-2.5 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((row, idx) => {
                          const hargaPerGram = row.item && row.item.berat_gram > 0 ? Math.round(row.hargaJual / row.item.berat_gram) : 0;
                          const rowTotal = row.item ? row.hargaJual * row.qty + row.ongkos : 0;
                          return (
                            <tr key={row.id}>
                              <td className="px-2.5 py-2 text-gray-400">{idx + 1}</td>
                              <td className="px-2.5 py-2 min-w-[110px]">
                                <AutocompleteField
                                  value={row.codeText}
                                  onChange={(v) => setCodeText(row.id, v)}
                                  onSelect={(it: InvItem) => selectItemForRow(row.id, it)}
                                  suggestions={suggestByCode(row.codeText)}
                                  renderLabel={(it) => it.id_item}
                                  renderSub={(it) => it.nama_produk}
                                  placeholder="Kode"
                                  inputClassName="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#C99A36]"
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[160px]">
                                <AutocompleteField
                                  value={row.nameText}
                                  onChange={(v) => setNameText(row.id, v)}
                                  onSelect={(it: InvItem) => selectItemForRow(row.id, it)}
                                  suggestions={suggestByName(row.nameText)}
                                  renderLabel={(it) => it.nama_produk}
                                  renderSub={(it) => `${it.id_item} · ${it.kadar}`}
                                  placeholder="Nama barang"
                                  inputClassName="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#C99A36]"
                                />
                              </td>
                              <td className="px-2.5 py-2 whitespace-nowrap">{row.item?.kadar ?? "-"}</td>
                              <td className="px-2.5 py-2 whitespace-nowrap">{row.item ? fmtGram(row.item.berat_gram) : "-"}</td>
                              <td className="px-2.5 py-2 min-w-[110px]">
                                <RpField
                                  disabled={!row.item}
                                  value={hargaPerGram}
                                  onChange={(v) => row.item && updateRow(row.id, { hargaJual: Math.round(v * row.item.berat_gram) })}
                                />
                              </td>
                              <td className="px-2.5 py-2 min-w-[100px]">
                                <RpField disabled={!row.item} value={row.ongkos} onChange={(v) => updateRow(row.id, { ongkos: v })} />
                              </td>
                              <td className="px-2.5 py-2 w-16">
                                <input
                                  type="number"
                                  min={1}
                                  max={rowMaxQty(row)}
                                  disabled={!row.item}
                                  value={row.qty}
                                  onChange={(e) => updateRow(row.id, { qty: Math.max(1, Math.min(parseInt(e.target.value) || 1, rowMaxQty(row))) })}
                                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"
                                />
                              </td>
                              <td className="px-2.5 py-2 font-bold whitespace-nowrap" style={{ color: "#6F5333" }}>{fmtRp(rowTotal)}</td>
                              <td className="px-2.5 py-2 text-center">
                                <button type="button" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600">🗑️</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full text-center py-2.5 text-sm font-semibold border-t border-gray-100 hover:bg-amber-50 transition-colors"
                    style={{ color: "#6F5333" }}
                  >
                    + Tambah Barang
                  </button>
                </div>
              </div>

              {/* Ringkasan Berat & Pembayaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Ringkasan Berat</p>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Total Berat</span>
                    <span className="font-semibold">{fmtGram(totalBerat)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Terbilang</span>
                    <p className="italic text-gray-700 mt-0.5 capitalize">{terbilang(total)} rupiah</p>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Ringkasan Pembayaran</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{fmtRp(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600">Diskon (Rp)</span>
                    <input
                      type="text"
                      value={diskon}
                      onChange={(e) => setDiskon(e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-[#C99A36]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <label className="flex items-center gap-1.5 text-gray-600 select-none cursor-pointer">
                      <input type="checkbox" checked={ppnEnabled} onChange={(e) => setPpnEnabled(e.target.checked)} className="accent-[#C99A36]" />
                      PPN (%)
                    </label>
                    <input
                      type="text"
                      disabled={!ppnEnabled}
                      value={ppnPercent}
                      onChange={(e) => setPpnPercent(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"
                    />
                  </div>
                  {ppnEnabled && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Jumlah PPN</span>
                      <span className="font-semibold">{fmtRp(ppnAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                    <span>TOTAL</span>
                    <span style={{ color: "#DC2626" }}>{fmtRp(total)}</span>
                  </div>
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Metode Pembayaran</p>
                <div className="grid grid-cols-3 gap-2 max-w-sm">
                  {(["Tunai", "Transfer", "QRIS"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        paymentMethod === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-[#C99A36]"
                      }`}
                      style={paymentMethod === m ? { backgroundColor: "#6F5333" } : {}}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Catatan (Opsional)</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  placeholder="Tuliskan catatan jika perlu..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C99A36] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setShowBuatInvoiceModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={simpanInvoice}
                disabled={saving || validRows.length === 0 || !paymentMethod || !pelangganNama.trim()}
                className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: "#6F5333" }}
              >
                {saving ? "⏳ Menyimpan..." : "💾 Simpan Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL: PREVIEW INVOICE SEBELUM CETAK
      ══════════════════════════════════ */}
      {showPreviewModal && invoiceReady && (
        <div id="preview-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Preview Invoice</h2>
                <p className="text-xs text-gray-400">Periksa kembali sebelum dicetak.</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-9 h-9 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl shadow-md p-5 mx-auto" style={{ maxWidth: 620 }}>
                <InvoiceCetak
                  mode="preview"
                  noInvoice={invoiceReady.noInvoice}
                  tanggal={invoiceReady.tanggal}
                  pelangganNama={pelangganNama}
                  pelangganHP={toFullPhone(pelangganHP)}
                  cart={cartForInvoice}
                  diskon={diskonNum}
                  subtotal={subtotal}
                  total={total}
                  totalBerat={totalBerat}
                  paymentMethod={paymentMethod}
                  ppnEnabled={ppnEnabled}
                  ppnPercent={ppnPercentNum}
                  ppnAmount={ppnAmount}
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100 rounded-b-2xl">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              >
                ✕ Tutup
              </button>
              <button
                onClick={() => printClean()}
                className="flex-1 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-all"
                style={{ backgroundColor: "#6F5333" }}
              >
                🖨️ Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
