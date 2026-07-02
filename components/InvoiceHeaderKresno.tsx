/* Header toko bersama untuk semua nota cetak (Gadai, Buyback, Servis) —
   tata letak & gaya disamakan dengan header invoice penjualan di app/pos/page.tsx. */
export const INVOICE_GOLD = "#000000";
export const INVOICE_GOLD_LT = "#888888";

interface InvoiceHeaderKresnoProps {
  judul: string;
  noNota: string;
  tanggal: string;
  extraLine?: string;
}

export function InvoiceHeaderKresno({ judul, noNota, tanggal, extraLine }: InvoiceHeaderKresnoProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "7pt",
      borderBottom: `2pt solid ${INVOICE_GOLD}`,
      paddingBottom: "5.5pt",
      marginBottom: "5.5pt",
    }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-kresno.png"
        alt="Logo"
        style={{ width: "43pt", height: "43pt", objectFit: "contain", flexShrink: 0 }}
      />

      {/* Nama & Info Toko */}
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{
          fontSize: "13.5pt", fontWeight: 900, color: INVOICE_GOLD,
          fontFamily: "Georgia, serif", letterSpacing: "0.04em",
        }}>
          TOKOMAS KRESNO
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5.5pt", margin: "1pt 0 2pt" }}>
          <div style={{ height: "1pt", width: "39.5pt", backgroundColor: INVOICE_GOLD_LT }} />
          <div style={{ fontSize: "7pt", fontWeight: 700, color: "#222", letterSpacing: "0.06em" }}>{judul}</div>
          <div style={{ height: "1pt", width: "39.5pt", backgroundColor: INVOICE_GOLD_LT }} />
        </div>
        <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#000" }}>
          Jl. Kios Pasar Grabag Petak Blok KA No. 7A-7B
        </div>
        <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#000" }}>
          (Depan Terminal Lama), Grabag, Magelang, Jawa Tengah
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "11pt", marginTop: "2pt", fontSize: "6pt", color: "#444" }}>
          <span>☎ 0821-8501-3553</span>
          <span>|</span>
          <span>✉ tokomaskresno5758@gmail.com</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "11pt", fontSize: "6pt", color: "#444" }}>
          <span>📷 tokomaskresno.grabag</span>
          <span>|</span>
          <span>🎵 Tk. Mas Kresno Grabag</span>
        </div>
      </div>

      {/* No Nota & Tanggal */}
      <div style={{ flexShrink: 0, textAlign: "right", minWidth: "76.5pt" }}>
        <div style={{ fontWeight: 900, fontSize: "7.5pt", color: "#111", letterSpacing: "0.02em" }}>
          NO. NOTA
        </div>
        <div style={{ fontWeight: 900, fontSize: "10pt", color: "#000", marginTop: "2pt" }}>
          {noNota}
        </div>
        <div style={{ fontSize: "6.5pt", fontWeight: 700, color: "#000", marginTop: "2pt" }}>
          Tanggal : {tanggal}
        </div>
        {extraLine && (
          <div style={{ fontSize: "7pt", color: "#555", marginTop: "1pt", fontWeight: 700 }}>
            {extraLine}
          </div>
        )}
      </div>
    </div>
  );
}
