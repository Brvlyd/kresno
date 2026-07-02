"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
  Dimensi A5 landscape: 210mm × 148mm
  Margin print: 10mm atas/bawah, 10mm kiri/kanan  →  @page { size: A5 landscape; margin: 10mm 10mm; }
  Konten:  (210 - 10 - 10) × (148 - 10 - 10)  =  190mm × 128mm

  Scale dihitung dari TOTAL lebar halaman (210mm), bukan lebar konten,
  supaya padding margin ikut masuk dalam kalkulasi dan div tidak overflow.
*/
const DPI = 96;
const mm = (v: number) => (v / 25.4) * DPI;

const PAGE_W_MM   = 210;   // A5 landscape width
const PAGE_H_MM   = 148;   // A5 landscape height
const MARGIN_LR   = 10;    // mm kiri & kanan
const MARGIN_TB   = 10;    // mm atas & bawah

const PAGE_TOTAL_W_PX   = mm(PAGE_W_MM);              // 210mm ≈ 794px  — untuk kalkulasi scale
const PAGE_CONTENT_W_PX = mm(PAGE_W_MM - 2 * MARGIN_LR); // 200mm ≈ 756px  — lebar konten
const PAGE_CONTENT_H_PX = mm(PAGE_H_MM - 2 * MARGIN_TB); // 128mm ≈ 484px  — tinggi konten

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
      // Scale berdasarkan TOTAL lebar A5 (termasuk padding kiri-kanan)
      const s = Math.min(1, wrap.clientWidth / PAGE_TOTAL_W_PX);
      setScale(s);
      setHeight(page.scrollHeight * s);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(page);
    return () => ro.disconnect();
  }, []);

  const overflows = height > PAGE_CONTENT_H_PX * scale;

  return (
    <div ref={wrapRef} className="mx-auto w-full overflow-hidden" style={{ height }}>
      <div
        ref={pageRef}
        className="mx-auto bg-white shadow-lg ring-1 ring-black/10"
        style={{
          width: PAGE_CONTENT_W_PX,
          padding: `${MARGIN_TB}mm ${MARGIN_LR}mm`,
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
