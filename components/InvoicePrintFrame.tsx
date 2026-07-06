import type { ReactNode } from "react";
import { DESIGN_CONTENT_WIDTH_MM, DESIGN_CONTENT_HEIGHT_MM } from "@/lib/invoiceSize";

/**
 * Bungkus invoice saat print: render kontennya tetap di ukuran desain asli
 * (170×145mm, diukur dari scrollHeight konten React invoice sungguhan) lalu
 * susutkan/besarkan lewat transform supaya pas dengan ukuran kertas yang
 * dipilih user — tanpa meluber ke halaman kedua. `zoom` CSS tidak dipakai
 * krn tidak konsisten pada mesin cetak-ke-PDF Chromium.
 *
 * Centering pakai `position:absolute; top/left:50%; translate(-50%,-50%) scale()`
 * — BUKAN flexbox `justifyContent`/`alignItems`. Flexbox center menghitung posisi
 * dari ukuran box SEBELUM transform (transform tidak mempengaruhi layout, cuma
 * visual), jadi kombinasi flex-center + transform:scale() salah hitung dan bikin
 * bagian atas invoice ke-crop. translate(-50%,-50%) aman krn persentasenya
 * dievaluasi dari ukuran elemen itu sendiri lalu scale() diterapkan dari titik
 * tengah yang sama, jadi hasilnya selalu presisi center berapa pun skalanya.
 *
 * Anchor #invoice-print (target CSS `@media print { #invoice-print { display:
 * block !important } }`) SELALU berupa wrapper polos terpisah di pemanggil,
 * bukan elemen ini sendiri — supaya #invoice-print konsisten "block" (aman utk
 * nota POS multi-halaman yang men-stack banyak InvoicePrintFrame vertikal).
 */
export function InvoicePrintFrame({
  children,
  widthMm,
  heightMm,
  marginMm,
}: {
  children: ReactNode;
  widthMm: number;
  heightMm: number;
  marginMm: number;
}) {
  const contentWMm = widthMm - 2 * marginMm;
  const contentHMm = heightMm - 2 * marginMm;
  const scale = Math.min(contentWMm / DESIGN_CONTENT_WIDTH_MM, contentHMm / DESIGN_CONTENT_HEIGHT_MM);

  return (
    <div
      style={{
        position: "relative",
        width: `${contentWMm}mm`,
        height: `${contentHMm}mm`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${DESIGN_CONTENT_WIDTH_MM}mm`,
          height: `${DESIGN_CONTENT_HEIGHT_MM}mm`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
