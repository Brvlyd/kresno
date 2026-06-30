import { InvoiceHeaderKresno, INVOICE_GOLD, INVOICE_GOLD_LT } from "@/components/InvoiceHeaderKresno";
import { fmtRupiah, fmtGram, tglIndo } from "@/lib/gadai";
import type { InvoiceBuybackData } from "@/lib/buyback";

interface InvoiceBuybackProps {
  mode: "print" | "preview";
  data: InvoiceBuybackData;
}

const MIN_ROWS = 6;

export function InvoiceBuyback({ mode, data }: InvoiceBuybackProps) {
  const isPrint = mode === "print";
  const emptyRows = Math.max(0, MIN_ROWS - 1);
  const totalBerat = data.berat_gram * data.jumlah;

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
      }}
    >
      <InvoiceHeaderKresno judul="NOTA BUYBACK" noNota={data.no_buyback} tanggal={tglIndo(data.tanggal)} />

      {/* ── TABEL BARANG ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", marginBottom: "8pt" }}>
        <thead>
          <tr style={{ backgroundColor: "#fff", color: "#000" }}>
            {[
              { label: "No",          w: "22pt", align: "center" as const },
              { label: "Nama Barang", w: "",     align: "left"   as const },
              { label: "Kadar",       w: "45pt", align: "center" as const },
              { label: "Berat",       w: "50pt", align: "center" as const },
              { label: "Harga/Gram",  w: "65pt", align: "right"  as const },
              { label: "Total",       w: "70pt", align: "right"  as const },
            ].map((h) => (
              <th key={h.label} style={{
                padding: "4pt 6pt", border: `0.5pt solid ${INVOICE_GOLD}`,
                fontWeight: 700, textAlign: h.align, width: h.w || undefined,
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>1</td>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
              {data.nama_barang}{data.jumlah > 1 ? ` (×${data.jumlah})` : ""}
            </td>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{data.kadar}</td>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{fmtGram(totalBerat)}</td>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "right" }}>{fmtRupiah(data.harga_per_gram)}</td>
            <td style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "right", fontWeight: 700 }}>{fmtRupiah(data.total)}</td>
          </tr>
          {Array.from({ length: emptyRows }, (_, i) => (
            <tr key={"emp-" + i}>
              {[...Array(6)].map((_, j) => (
                <td key={j} style={{ padding: "5pt 6pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTAL ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8pt" }}>
        <div style={{ minWidth: "200pt", border: `1pt solid ${INVOICE_GOLD_LT}`, borderRadius: "4pt", overflow: "hidden", fontSize: "10pt", fontWeight: 700 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3pt 10pt", borderBottom: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
            <span>Total Berat</span>
            <span>: {fmtGram(totalBerat)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3pt 10pt", borderBottom: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
            <span>Harga Total</span>
            <span>: {fmtRupiah(data.total)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "4pt 10pt", backgroundColor: "#fff",
            color: "#000", fontWeight: 900, fontSize: "11pt",
          }}>
            <span>TOTAL</span>
            <span>: {fmtRupiah(data.total)}</span>
          </div>
        </div>
      </div>

      {/* ── KETENTUAN ── */}
      <div style={{ fontSize: "7pt", marginBottom: "6pt" }}>
        <div style={{ fontWeight: 900, fontSize: "8pt", marginBottom: "3pt" }}>KETENTUAN BUYBACK TOKO EMAS :</div>
        <ul style={{ margin: 0, paddingLeft: "12pt", lineHeight: "1.45", listStyleType: "disc" }}>
          <li>Harga buyback mengikuti harga pasaran toko yang berlaku pada saat transaksi.</li>
          <li>Penilaian dilakukan berdasarkan kadar, berat, dan kondisi perhiasan.</li>
          <li>Perhiasan yang mengandung batu, patri, modifikasi, atau mengalami kerusakan akan dinilai dengan harga yang berbeda.</li>
          <li>Toko berhak menentukan atau menolak pembelian kembali apabila perhiasan tidak sesuai standar atau tidak dapat diverifikasi keasliannya.</li>
          <li>Transaksi buyback tidak dapat dibatalkan setelah disetujui.</li>
          <li>Nota ini adalah bukti sah transaksi buyback, harap disimpan dengan baik.</li>
        </ul>
      </div>

      {/* ── TANDA TANGAN ── */}
      <div style={{ display: "flex", gap: "20pt", paddingTop: "5pt", borderTop: `1pt dashed ${INVOICE_GOLD}`, fontSize: "7pt" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Penerima,</div>
          <div style={{ marginTop: "20pt" }}>(.................................)</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Pelanggan,</div>
          <div style={{ marginTop: "20pt" }}>(.................................)</div>
        </div>
      </div>
    </div>
  );
}
