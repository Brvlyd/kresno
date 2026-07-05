import type { ReactNode } from "react";
import { DESIGN_CONTENT_WIDTH_MM, DESIGN_CONTENT_HEIGHT_MM } from "@/lib/invoiceSize";

/**
 * Bungkus invoice saat print: render kontennya tetap di ukuran desain asli
 * (190×128mm, ukuran yg jadi acuan semua invoice) lalu susutkan/besarkan lewat
 * transform supaya pas dengan ukuran kertas yang dipilih user — tanpa meluber
 * ke halaman kedua. `zoom` CSS tidak dipakai krn tidak konsisten pada mesin
 * cetak-ke-PDF Chromium; transform+overflow:hidden yang terbukti bekerja.
 *
 * `id` hanya diisi kalau elemen ini adalah anchor #invoice-print (target CSS
 * `@media print { #invoice-print { display: block !important } }`). Kalau
 * dipakai bersarang di dalam grup yg id-nya sudah ada di elemen luar (kasus
 * nota POS multi-halaman), biarkan id kosong supaya tidak duplikat.
 */
export function InvoicePrintFrame({
  children,
  widthMm,
  heightMm,
  marginMm,
  id,
}: {
  children: ReactNode;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  id?: string;
}) {
  const contentWMm = widthMm - 2 * marginMm;
  const contentHMm = heightMm - 2 * marginMm;
  const scale = Math.min(contentWMm / DESIGN_CONTENT_WIDTH_MM, contentHMm / DESIGN_CONTENT_HEIGHT_MM);

  return (
    <div
      id={id}
      style={{
        display: id ? "none" : "flex",
        justifyContent: "center",
        alignItems: "center",
        width: `${contentWMm}mm`,
        height: `${contentHMm}mm`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
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
