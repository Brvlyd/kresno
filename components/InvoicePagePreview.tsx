"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
  Ukuran halaman preview mengikuti ukuran kertas cetak (widthMm × heightMm),
  default ukuran standar toko 184mm × 120mm bila tidak diisi.
  Margin print default 10mm tiap sisi → @page { size: <widthMm>mm <heightMm>mm; margin: <marginMm>mm; }
  Konten:  (widthMm - 2*marginMm) × (heightMm - 2*marginMm)

  Scale dihitung dari TOTAL lebar halaman (widthMm), bukan lebar konten,
  supaya padding margin ikut masuk dalam kalkulasi dan div tidak overflow.
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
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  const pageTotalWPx = mm(widthMm);
  const pageContentWPx = mm(widthMm - 2 * marginMm);
  const pageContentHPx = mm(heightMm - 2 * marginMm);

  useEffect(() => {
    const wrap = wrapRef.current;
    const page = pageRef.current;
    if (!wrap || !page) return;

    const update = () => {
      // Scale berdasarkan TOTAL lebar halaman (termasuk padding kiri-kanan)
      const s = Math.min(1, wrap.clientWidth / pageTotalWPx);
      setScale(s);
      setHeight(page.scrollHeight * s);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(page);
    return () => ro.disconnect();
  }, [pageTotalWPx]);

  const overflows = height > pageContentHPx * scale;

  return (
    <div ref={wrapRef} className="mx-auto w-full overflow-hidden" style={{ height }}>
      <div
        ref={pageRef}
        className="mx-auto bg-white shadow-lg ring-1 ring-black/10"
        style={{
          width: pageContentWPx,
          padding: `${marginMm}mm ${marginMm}mm`,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          outline: overflows ? "2px solid #ef4444" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
