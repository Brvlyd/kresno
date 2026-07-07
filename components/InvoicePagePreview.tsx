"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { InvoicePrintFrame } from "@/components/InvoicePrintFrame";

/*
  Preview di layar HARUS pakai frame & rumus scale yang SAMA PERSIS dengan yang
  dipakai saat print/print-to-PDF (InvoicePrintFrame — fixed di ukuran desain
  DESIGN_CONTENT_WIDTH/HEIGHT_MM lalu discale ke ukuran kertas terpilih), supaya
  tidak ada beda tampilan antara preview dan hasil cetak sungguhan. Print-to-PDF
  dan cetak ke printer fisik sama-sama cuma beda "destination" dari window.print()
  yang sama, jadi keduanya otomatis konsisten begitu preview memakai frame ini.

  Lapisan scale KEDUA di sini murni utk responsif di layar (supaya kertas besar
  tidak meluber dari lebar modal) — tidak mempengaruhi rasio/posisi konten,
  cuma memperkecil seluruh "kertas" (yang isinya sudah di-scale InvoicePrintFrame)
  agar pas dengan lebar container.
*/
const DPI = 96;
const mm = (v: number) => (v / 25.4) * DPI;

export function InvoicePagePreview({
  children,
  widthMm = 184,
  heightMm = 120,
  marginMm = 10,
}: {
  children: ReactNode;
  widthMm?: number;
  heightMm?: number;
  marginMm?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const pageWPx = mm(widthMm);
  const pageHPx = mm(heightMm);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const update = () => setScale(Math.min(1, wrap.clientWidth / pageWPx));

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [pageWPx]);

  return (
    <div ref={wrapRef} className="mx-auto w-full overflow-hidden" style={{ height: pageHPx * scale }}>
      <div
        className="mx-auto bg-white shadow-lg ring-1 ring-black/10"
        style={{
          width: pageWPx,
          height: pageHPx,
          padding: mm(marginMm),
          boxSizing: "border-box",
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <InvoicePrintFrame widthMm={widthMm} heightMm={heightMm} marginMm={marginMm}>
          {children}
        </InvoicePrintFrame>
      </div>
    </div>
  );
}
