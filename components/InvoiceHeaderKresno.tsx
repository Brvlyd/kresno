/* Header toko bersama untuk semua nota cetak (Gadai, Buyback, Servis) —
   tata letak & gaya disamakan dengan header invoice penjualan di app/pos/page.tsx. */
export const INVOICE_GOLD = "#8B6914";
export const INVOICE_GOLD_LT = "#D4A853";

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
      gap: "8pt",
      borderBottom: `2pt solid ${INVOICE_GOLD}`,
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
          fontSize: "15pt", fontWeight: 900, color: INVOICE_GOLD,
          fontFamily: "Georgia, serif", letterSpacing: "0.04em",
        }}>
          TOKOMAS KRESNO
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6pt", margin: "1pt 0 2pt" }}>
          <div style={{ height: "1pt", width: "44pt", backgroundColor: INVOICE_GOLD_LT }} />
          <div style={{ fontSize: "8pt", fontWeight: 700, color: "#222", letterSpacing: "0.06em" }}>{judul}</div>
          <div style={{ height: "1pt", width: "44pt", backgroundColor: INVOICE_GOLD_LT }} />
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

      {/* No Nota & Tanggal */}
      <div style={{ flexShrink: 0, textAlign: "right", minWidth: "85pt" }}>
        <div style={{ fontWeight: 900, fontSize: "8.5pt", color: "#111", letterSpacing: "0.02em" }}>
          NO. NOTA
        </div>
        <div style={{ fontWeight: 900, fontSize: "11pt", color: "#DC2626", marginTop: "2pt" }}>
          {noNota}
        </div>
        <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2pt" }}>
          Tanggal : {tanggal}
        </div>
        {extraLine && (
          <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "1pt", fontWeight: 700 }}>
            {extraLine}
          </div>
        )}
      </div>
    </div>
  );
}
