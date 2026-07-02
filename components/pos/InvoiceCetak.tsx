import StorageImage from "@/components/StorageImage";
import { fmtGram, fmtRp, terbilang, type InvoiceProps } from "@/lib/riwayatTransaksi";

/* ═══════════════════════════════════════════════════════
   KOMPONEN: INVOICE (dipakai utk cetak & preview)
═══════════════════════════════════════════════════════ */
export default function InvoiceCetak(p: InvoiceProps) {
  const GOLD = "#000000";
  const GOLD_LT = "#888888";
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
        fontSize: "7pt",
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
        gap: "7pt",
        borderBottom: `2pt solid ${GOLD}`,
        paddingBottom: "4.5pt",
        marginBottom: "3.5pt",
      }}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-kresno.png"
          alt="Logo"
          style={{ width: "38pt", height: "38pt", objectFit: "contain", flexShrink: 0 }}
        />

        {/* Nama & Info Toko */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            fontSize: "11.5pt", fontWeight: 900, color: GOLD,
            fontFamily: "Georgia, serif", letterSpacing: "0.04em",
          }}>
            TOKOMAS KRESNO
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5.5pt", margin: "0.5pt 0 1pt" }}>
            <div style={{ height: "1pt", width: "32pt", backgroundColor: GOLD_LT }} />
            <div style={{ width: "3pt", height: "3pt", backgroundColor: GOLD_LT, transform: "rotate(45deg)" }} />
            <div style={{ height: "1pt", width: "32pt", backgroundColor: GOLD_LT }} />
          </div>
          <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#000" }}>
            Jl. Kios Pasar Grabag Petak Blok KA No. 7A-7B
          </div>
          <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#000" }}>
            (Depan Terminal Lama), Grabag, Magelang, Jawa Tengah
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "7pt", rowGap: "1pt", marginTop: "1pt", fontSize: "5.5pt", fontWeight: 700, color: "#444" }}>
            <span style={{ whiteSpace: "nowrap" }}>☎ 0821-8501-3553</span>
            <span>|</span>
            <span style={{ whiteSpace: "nowrap" }}>✉ tokomaskresno5758@gmail.com</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "7pt", rowGap: "1pt", fontSize: "5.5pt", fontWeight: 700, color: "#444" }}>
            <span style={{ whiteSpace: "nowrap" }}>📷 tokomaskresno.grabag</span>
            <span>|</span>
            <span style={{ whiteSpace: "nowrap" }}>🎵 Tk. Mas Kresno Grabag</span>
          </div>
        </div>

        {/* No Invoice & Tanggal */}
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: "76.5pt" }}>
          <div style={{ fontWeight: 900, fontSize: "7.5pt", color: "#111", letterSpacing: "0.02em" }}>
            NOTA / INVOICE
          </div>
          <div style={{ fontWeight: 900, fontSize: "10pt", color: "#000", marginTop: "2pt" }}>
            {p.noInvoice}
          </div>
          <div style={{ fontSize: "6.5pt", color: "#000", marginTop: "2pt", fontWeight: 700 }}>
            Tanggal : {p.tanggal}
          </div>
          <div style={{ fontSize: "6.5pt", color: "#555", marginTop: "1pt", fontWeight: 700 }}>
            {p.paymentMethod}
          </div>
        </div>
      </div>

      {/* ── INFO PELANGGAN ── */}
      <div style={{ display: "flex", gap: "18pt", marginBottom: "3.5pt", fontSize: "8pt", fontWeight: 700 }}>
        <div style={{ flex: 1 }}>
          Nama Pelanggan :{" "}
          <span style={{ borderBottom: "0.75pt solid #000", display: "inline-block", minWidth: "153pt", paddingRight: "5.5pt" }}>
            {p.pelangganNama}
          </span>
        </div>
        <div style={{ fontSize: "9pt" }}>
          No. HP :{" "}
          <span style={{ borderBottom: "0.75pt solid #000", display: "inline-block", minWidth: "85.5pt" }}>
            {p.pelangganHP}
          </span>
        </div>
      </div>

      {/* ── FOTO + TABEL BARANG ── */}
      <div style={{ display: "flex", gap: "7pt", marginBottom: "3.5pt" }}>
        {/* Foto barang */}
        <div style={{
          width: "50pt", flexShrink: 0,
          border: `1.5pt solid ${GOLD}`, borderRadius: "3.5pt",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          backgroundColor: "#fff",
        }}>
          {p.cart.length > 0 && p.cart[0].gambarUrl ? (
            <StorageImage
              src={p.cart[0].gambarUrl}
              alt="Foto Barang"
              style={{ width: "43pt", height: "43pt", objectFit: "cover", borderRadius: "2.5pt" }}
            />
          ) : (
            <>
              <div style={{ fontSize: "12.5pt", color: "#ccc" }}>📷</div>
              <div style={{ fontSize: "5pt", color: "#aaa", marginTop: "2pt" }}>4 x 4 cm</div>
            </>
          )}
        </div>

        {/* Tabel item */}
        <table style={{ flex: 1, borderCollapse: "collapse", fontSize: "6pt" }}>
          <thead>
            <tr style={{ backgroundColor: "#fff", color: "#000" }}>
              {[
                { label: "No",         w: "18pt",  align: "center" as const },
                { label: "Nama Barang", w: "",      align: "left"   as const },
                { label: "Kadar",       w: "31pt",  align: "center" as const },
                { label: "Berat",       w: "40pt",  align: "center" as const },
                { label: "Harga/Gram",  w: "54pt",  align: "right"  as const },
                { label: "Ongkos",      w: "45pt",  align: "right"  as const },
                { label: "Total",       w: "54pt",  align: "right"  as const },
              ].map((h) => (
                <th key={h.label} style={{
                  padding: "1.5pt 3.5pt",
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
              const hargaPerGram = ci.beratGram > 0
                ? Math.round(ci.hargaJual / ci.beratGram) : 0;
              const totalItem = ci.hargaJual * ci.qty + ci.ongkos;
              return (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#F2F2F2" }}>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}` }}>
                    {ci.namaProduk}{ci.qty > 1 ? ` (×${ci.qty})` : ""}
                  </td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{ci.kadar}</td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "center" }}>{fmtGram(ci.beratGram * ci.qty)}</td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right" }}>{fmtRp(hargaPerGram)}</td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right" }}>{ci.ongkos > 0 ? fmtRp(ci.ongkos) : "-"}</td>
                  <td style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}`, textAlign: "right", fontWeight: 700 }}>{fmtRp(totalItem)}</td>
                </tr>
              );
            })}
            {/* Baris kosong pengisi */}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={"emp-" + i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F2F2F2" }}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} style={{ padding: "1.5pt 3.5pt", border: `0.5pt solid ${GOLD_LT}` }}>&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTAL BERAT + RINGKASAN HARGA ── */}
      <div style={{ display: "flex", gap: "9pt", marginBottom: "3.5pt" }}>
        {/* Kiri: berat & terbilang */}
        <div style={{
          flex: 1, border: `1pt solid ${GOLD_LT}`,
          borderRadius: "4pt", padding: "3.5pt 7pt", fontSize: "6.5pt",
        }}>
          <div style={{ display: "flex", gap: "3.5pt", alignItems: "center", marginBottom: "3pt" }}>
            <span style={{ minWidth: "54pt", fontWeight: 600 }}>Total Berat</span>
            <span>:</span>
            <span style={{ borderBottom: "0.75pt solid #000", flex: 1, paddingRight: "3.5pt" }}>
              {fmtGram(p.totalBerat)}
            </span>
            <span>gram</span>
          </div>
          <div style={{ display: "flex", gap: "3.5pt", alignItems: "flex-start" }}>
            <span style={{ minWidth: "54pt", fontWeight: 600 }}>Terbilang</span>
            <span>:</span>
            <span style={{
              borderBottom: "0.75pt solid #000", flex: 1,
              textTransform: "capitalize", lineHeight: "1.3",
            }}>
              {terbilangText}
            </span>
          </div>
        </div>

        {/* Kanan: subtotal/diskon/total */}
        <div style={{
          minWidth: "148.5pt", border: `1pt solid ${GOLD_LT}`,
          borderRadius: "4pt", overflow: "hidden", fontSize: "8pt", fontWeight: 700,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 7pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
            <span>Subtotal</span>
            <span>: {fmtRp(p.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 7pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
            <span>Diskon</span>
            <span>: {fmtRp(p.diskon)}</span>
          </div>
          {p.ppnEnabled && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2pt 7pt", borderBottom: `0.5pt solid ${GOLD_LT}` }}>
              <span>PPN ({p.ppnPercent}%)</span>
              <span>: {fmtRp(p.ppnAmount)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "2.5pt 7pt", backgroundColor: "#fff",
            color: "#000", fontWeight: 900, fontSize: "9pt",
          }}>
            <span>TOTAL</span>
            <span>: {fmtRp(p.total)}</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER: KETENTUAN + TANDA TANGAN ── */}
      <div style={{
        display: "flex", gap: "18pt",
        paddingTop: "3.5pt", borderTop: `1pt dashed ${GOLD}`,
        fontSize: "6pt", marginTop: "1pt",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: "7pt", marginBottom: "2pt" }}>KETENTUAN :</div>
          <ul style={{ margin: 0, paddingLeft: "10pt", lineHeight: "1.3" }}>
            <li>Barang, kadar, dan berat telah diperiksa serta disetujui oleh pembeli.</li>
            <li>Perhiasan emas dapat dijual kembali sesuai harga pasaran toko yang berlaku dengan memperhitungkan kondisi barang dan potongan ongkos.</li>
            <li>Perhiasan yang mengandung batu, patri, atau mengalami kerusakan akan dinilai dengan harga yang berbeda.</li>
          </ul>
        </div>
        <div style={{ minWidth: "90pt", textAlign: "right" }}>
          <div>Hormat kami,</div>
          <div style={{ marginTop: "12.5pt", borderTop: "0.75pt solid #000", paddingTop: "2pt", textAlign: "center" }}>
            (.................................)
          </div>
        </div>
      </div>
    </div>
  );
}
