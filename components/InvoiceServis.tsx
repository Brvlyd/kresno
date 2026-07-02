import { InvoiceHeaderKresno, INVOICE_GOLD, INVOICE_GOLD_LT } from "@/components/InvoiceHeaderKresno";
import { fmtRupiah, fmtGram, tglIndo } from "@/lib/gadai";
import type { InvoiceServisData } from "@/lib/servis";

interface InvoiceServisProps {
  mode: "print" | "preview";
  data: InvoiceServisData;
}

const MIN_ROWS = 5;

export function InvoiceServis({ mode, data }: InvoiceServisProps) {
  const isPrint = mode === "print";
  const emptyRows = Math.max(0, MIN_ROWS - 1);
  const sisaPembayaran = Math.max(0, data.estimasi_biaya - data.uang_muka);

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
      <InvoiceHeaderKresno judul="NOTA SERVICE PERHIASAN" noNota={data.no_servis} tanggal={tglIndo(data.tanggal_masuk)} />

      {/* ── TABEL BARANG ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "6.5pt", marginBottom: "7pt" }}>
        <thead>
          <tr style={{ backgroundColor: "#fff", color: "#000" }}>
            {[
              { label: "No",               w: "18pt", align: "center" as const },
              { label: "Nama Barang",      w: "",     align: "left"   as const },
              { label: "Kadar",            w: "31pt", align: "center" as const },
              { label: "Berat",            w: "38pt", align: "center" as const },
              { label: "Jenis Service",    w: "54pt", align: "center" as const },
              { label: "Tanggal Masuk",    w: "45pt", align: "center" as const },
              { label: "Estimasi Selesai", w: "45pt", align: "center" as const },
              { label: "Biaya",            w: "54pt", align: "right"  as const },
            ].map((h) => (
              <th key={h.label} style={{
                padding: "3.5pt 4.5pt", border: `0.5pt solid ${INVOICE_GOLD}`,
                fontWeight: 700, textAlign: h.align, width: h.w || undefined,
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>1</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>{data.nama_barang}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{data.kadar}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{fmtGram(data.berat_gram)}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{data.jenis_servis}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{tglIndo(data.tanggal_masuk)}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "center" }}>{tglIndo(data.estimasi_selesai)}</td>
            <td style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}`, textAlign: "right", fontWeight: 700 }}>{fmtRupiah(data.estimasi_biaya)}</td>
          </tr>
          {Array.from({ length: emptyRows }, (_, i) => (
            <tr key={"emp-" + i}>
              {[...Array(8)].map((_, j) => (
                <td key={j} style={{ padding: "4.5pt", border: `0.5pt solid ${INVOICE_GOLD_LT}` }}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTAL ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "7pt" }}>
        <div style={{ minWidth: "180pt", border: `1pt solid ${INVOICE_GOLD_LT}`, borderRadius: "4pt", overflow: "hidden", fontSize: "9pt", fontWeight: 700 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5pt 9pt", borderBottom: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
            <span>Total Biaya Service</span>
            <span>: {fmtRupiah(data.estimasi_biaya)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5pt 9pt", borderBottom: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
            <span>Uang Muka</span>
            <span>: {fmtRupiah(data.uang_muka)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5pt 9pt", borderBottom: `0.5pt solid ${INVOICE_GOLD_LT}` }}>
            <span>Sisa Pembayaran</span>
            <span>: {fmtRupiah(sisaPembayaran)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "3.5pt 9pt", backgroundColor: "#fff",
            color: "#000", fontWeight: 900, fontSize: "10pt",
          }}>
            <span>TOTAL</span>
            <span>: {fmtRupiah(data.estimasi_biaya)}</span>
          </div>
        </div>
      </div>

      {/* ── KETENTUAN ── */}
      <div style={{ fontSize: "6.5pt", marginBottom: "5.5pt" }}>
        <div style={{ fontWeight: 900, fontSize: "7pt", marginBottom: "3pt" }}>KETENTUAN SERVICE PERHIASAN :</div>
        <ul style={{ margin: 0, paddingLeft: "11pt", lineHeight: "1.45", listStyleType: "disc" }}>
          <li>Barang yang diserahkan untuk service telah diperiksa dan disetujui oleh pelanggan.</li>
          <li>Estimasi selesai adalah perkiraan waktu pengerjaan dan dapat berubah menyesuaikan kondisi barang.</li>
          <li>Biaya service dapat berubah jika terdapat tambahan perbaikan di luar kesepakatan awal.</li>
          <li>Toko tidak bertanggung jawab atas kehilangan batu permata / bagian tambahan yang tidak diketahui sebelumnya.</li>
          <li>Setelah barang selesai dikerjakan, harap segera diambil maksimal 30 hari. Lebih dari itu, toko tidak bertanggung jawab atas risiko kehilangan atau kerusakan.</li>
          <li>Dengan melakukan transaksi, pelanggan dianggap telah menyetujui seluruh ketentuan service yang berlaku.</li>
        </ul>
      </div>

      {/* ── TANDA TANGAN ── */}
      <div style={{ display: "flex", gap: "18pt", paddingTop: "4.5pt", borderTop: `1pt dashed ${INVOICE_GOLD}`, fontSize: "6.5pt" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Penerima,</div>
          <div style={{ marginTop: "18pt" }}>(.................................)</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div>Pelanggan,</div>
          <div style={{ marginTop: "18pt" }}>(.................................)</div>
        </div>
      </div>
    </div>
  );
}
