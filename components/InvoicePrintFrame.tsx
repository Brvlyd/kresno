import type { ReactNode } from "react";
import { DESIGN_CONTENT_WIDTH_MM, DESIGN_CONTENT_HEIGHT_MM } from "@/lib/invoiceSize";

/**
 * Bungkus invoice saat print: render kontennya tetap di ukuran desain asli
 * (170×145mm, diukur dari scrollHeight konten React invoice sungguhan) lalu
 * susutkan/besarkan lewat transform supaya pas dengan UKURAN INVOICE yang dipilih
 * user — tanpa meluber ke halaman kedua. `zoom` CSS tidak dipakai krn tidak
 * konsisten pada mesin cetak-ke-PDF Chromium.
 *
 * PENTING soal konsep ukuran: widthMm/heightMm di sini = ukuran INVOICE-nya sendiri
 * (area yang tercetak), BUKAN ukuran kertas. Margin diatur DI LUAR frame ini — lewat
 * @page saat print (kertas = invoice + 2×margin) dan lewat padding di
 * InvoicePagePreview saat preview — sehingga frame cukup dirender persis
 * widthMm × heightMm.
 *
 * Centering pakai `position:absolute` + offset mm EKSPLISIT + `scale()` dari
 * `transform-origin: top left` — BUKAN flexbox center (flex menghitung posisi dari
 * ukuran box SEBELUM transform, bikin atas invoice ke-crop) dan BUKAN
 * `top/left:50% + translate(-50%,-50%)`: translate persen pada elemen absolut
 * tidak reliabel di mesin fragmentasi print Chromium — saat dicetak multi-halaman
 * (rangkap 2), salah satu halaman kontennya melorot puluhan mm lalu terpotong
 * bawah (diverifikasi via headless Chrome print-to-PDF). Offset mm konkret +
 * origin top-left menghasilkan geometri center yang sama persis tapi deterministik
 * di print maupun preview.
 *
 * Anchor #invoice-print (target CSS `@media print { #invoice-print { display:
 * block !important } }`) SELALU berupa wrapper polos terpisah di pemanggil,
 * bukan elemen ini sendiri — supaya #invoice-print konsisten "block" (aman utk
 * nota multi-halaman yang men-stack banyak InvoicePrintFrame vertikal).
 */
export function InvoicePrintFrame({
  children,
  widthMm,
  heightMm,
}: {
  children: ReactNode;
  widthMm: number;
  heightMm: number;
  /** Tak dipakai lagi — dipertahankan agar call-site lama yang meneruskan margin tetap
   *  kompatibel. Margin kini diatur di luar frame (@page saat print, padding saat preview). */
  marginMm?: number;
}) {
  const scale = Math.min(widthMm / DESIGN_CONTENT_WIDTH_MM, heightMm / DESIGN_CONTENT_HEIGHT_MM);
  const offsetXMm = (widthMm - DESIGN_CONTENT_WIDTH_MM * scale) / 2;
  const offsetYMm = (heightMm - DESIGN_CONTENT_HEIGHT_MM * scale) / 2;

  return (
    <div
      style={{
        position: "relative",
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: `${offsetYMm}mm`,
          left: `${offsetXMm}mm`,
          width: `${DESIGN_CONTENT_WIDTH_MM}mm`,
          height: `${DESIGN_CONTENT_HEIGHT_MM}mm`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
