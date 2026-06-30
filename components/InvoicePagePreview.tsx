"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* Lebar area cetak nota: kertas A5 landscape (210mm) dikurangi margin
   cetak 10mm kiri-kanan — harus sama persis dengan `@page { size: A5
   landscape; margin: 10mm; }` di tiap halaman cetak, supaya preview di
   layar terlihat seperti ukuran kertas asli. */
const PAGE_WIDTH_PX = (190 / 25.4) * 96; // 190mm → px @96dpi ≈ 718px

export function InvoicePagePreview({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const page = pageRef.current;
    if (!wrap || !page) return;

    const update = () => {
      const s = Math.min(1, wrap.clientWidth / PAGE_WIDTH_PX);
      setScale(s);
      setHeight(page.scrollHeight * s);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(page);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="mx-auto w-full" style={{ height }}>
      <div
        ref={pageRef}
        className="mx-auto bg-white shadow-lg ring-1 ring-black/10"
        style={{
          width: PAGE_WIDTH_PX,
          padding: "10mm",
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
