import { useRef } from "react";

/* ─── Input tanggal — klik di mana saja pada field langsung membuka kalender ─── */
export default function DateField({
  value, onChange, className = "",
}: { value: string; onChange: (v: string) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  function openPicker() {
    try { ref.current?.showPicker?.(); } catch { /* browser tidak dukung showPicker() */ }
  }
  return (
    <input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={openPicker}
      onFocus={openPicker}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A36] cursor-pointer ${className}`}
    />
  );
}
