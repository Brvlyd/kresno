import { InvoiceHeaderKresno, INVOICE_GOLD, INVOICE_GOLD_LT } from "@/components/InvoiceHeaderKresno";
import { fmtRupiah, fmtGram, tglIndo, terbilang } from "@/lib/gadai";
import type { InvoiceGadaiData } from "@/lib/gadai";

interface InvoiceGadaiProps {
  mode: "print" | "preview";
  data: InvoiceGadaiData;
}

const MIN_ROWS = 5;

export function InvoiceGadai({ mode, data }: InvoiceGadaiProps) {
  const isPrint = mode === "print";
  const items = data.items;
  const showTotal = items.length > 1;
  const emptyRows = Math.max(0, MIN_ROWS - items.length - (showTotal ? 1 : 0));
  const totalBerat = items.reduce((s, it) => s + (it.berat_gram || 0), 0);
  const kadarUnik = new Set(items.map((it) => it.kadar));
  const kadarTotal = kadarUnik.size === 1 ? items[0]?.kadar ?? "" : "Campuran";

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
      }}
    >
      <InvoiceHeaderKresno judul="NOTA GADAI" noNota={data.no_gadai} tanggal={tglIndo(data.tanggal_gadai)} />

      {/* ── TABEL BARANG ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt", marginBottom: "7pt" }}>
        <thead>
          <tr style={{ backgroundColor: "#fff", color: "#000" }}>
            {[
              { label: "No",           w: "20pt", align: "center" as const },
              { label: "Jenis Barang", w: "",     align: "left"   as const },
              { label: "Berat",        w: "63pt", align: "center" as const },
              { label: "Kadar",        w: "63pt", align: "center" as const },
            ].map((h) => (
              <th key={h.label} style={{
                padding: "3.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD}`,
                fontWeight: 700, textAlign: h.align, width: h.w || undefined,
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={"item-" + i}>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{i + 1}</td>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
                {item.jenis_perhiasan}{item.nama_barang ? ` — ${item.nama_barang}` : ""}
              </td>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{fmtGram(item.berat_gram)}</td>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{item.kadar}</td>
            </tr>
          ))}
          {showTotal && (
            <tr style={{ backgroundColor: INVOICE_GOLD_LT, fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "right" }}>Total Berat</td>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{fmtGram(totalBerat)}</td>
              <td style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{kadarTotal}</td>
            </tr>
          )}
          {Array.from({ length: emptyRows }, (_, i) => (
            <tr key={"emp-" + i}>
              {[...Array(4)].map((_, j) => (
                <td key={j} style={{ padding: "4.5pt 5.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── NOMINAL GADAI + JANGKA WAKTU ── */}
      <div style={{ display: "flex", gap: "9pt", marginBottom: "7pt" }}>
        <div style={{ flex: 1, border: `1pt solid ${INVOICE_GOLD}`, borderRadius: "4pt", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#fff", color: "#000", fontWeight: 700, padding: "2.5pt 7pt", fontSize: "6.5pt", textAlign: "center" }}>
            NOMINAL GADAI
          </div>
          <div style={{ padding: "7pt 9pt" }}>
            <div style={{ fontWeight: 900, fontSize: "10pt" }}>{fmtRupiah(data.nilai_pinjaman)}</div>
            <div style={{ fontSize: "6.5pt", color: "#555", marginTop: "3pt", textTransform: "capitalize" }}>
              ( {terbilang(data.nilai_pinjaman)} rupiah )
            </div>
          </div>
        </div>
        <div style={{ flex: 1, border: `1pt solid ${INVOICE_GOLD}`, borderRadius: "4pt", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#fff", color: "#000", fontWeight: 700, padding: "2.5pt 7pt", fontSize: "6.5pt", textAlign: "center" }}>
            JANGKA WAKTU
          </div>
          <div style={{ padding: "5.5pt 9pt", fontSize: "8.5pt", fontWeight: 700 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2pt" }}>
              <span>Mulai</span><span>: {tglIndo(data.tanggal_gadai)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2pt" }}>
              <span>Jatuh Tempo</span><span>: {tglIndo(data.tanggal_jatuh_tempo)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Bunga</span><span>: {data.bunga_persen}% per bulan</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KETENTUAN + CATATAN ── */}
      <div style={{ display: "flex", gap: "9pt", marginBottom: "7pt" }}>
        <div style={{ flex: 1, fontSize: "6.5pt" }}>
          <div style={{ fontWeight: 900, fontSize: "7pt", marginBottom: "3pt" }}>KETENTUAN :</div>
          <ul style={{ margin: 0, paddingLeft: "11pt", lineHeight: "1.45", listStyleType: "disc" }}>
            <li>Nominal gadai ditentukan berdasarkan hasil penilaian kondisi dan kadar perhiasan.</li>
            <li>Setiap transaksi dikenakan bunga sebesar {data.bunga_persen}% per bulan.</li>
            <li>Total pelunasan yang harus dibayarkan adalah nominal gadai ditambah bunga sesuai jangka waktu gadai.</li>
            <li>Perhiasan dapat ditebus setelah seluruh kewajiban pelunasan diselesaikan.</li>
          </ul>
        </div>
        <div style={{ flex: 1, border: `1pt solid ${INVOICE_GOLD_LT}`, borderRadius: "4pt", padding: "5.5pt 7pt", fontSize: "6.5pt" }}>
          <div style={{ fontWeight: 900, fontSize: "7pt", marginBottom: "3pt" }}>CATATAN :</div>
          <div style={{ minHeight: "27pt", color: "#555" }}>{data.catatan || ""}</div>
        </div>
      </div>

      {/* ── TANDA TANGAN ── */}
      <div style={{ display: "flex", gap: "18pt", paddingTop: "4.5pt", borderTop: `1pt dashed ${INVOICE_GOLD}`, fontSize: "6.5pt" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Penerima,</div>
          <div style={{ marginTop: "18pt" }}>(.................................)</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Pemberi Gadai,</div>
          <div style={{ marginTop: "18pt" }}>(.................................)</div>
        </div>
      </div>
    </div>
  );
}
