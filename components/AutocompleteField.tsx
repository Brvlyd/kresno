"use client";

import { useState } from "react";

export interface AutocompleteFieldProps<T> {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: T) => void;
  suggestions: T[];
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => string;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
  noResultsText?: string;
}

/** Field ketik-atau-pilih: chevron menandakan ada daftar pilihan, dan daftar
 * tetap muncul saat field masih kosong (browse) — bukan cuma setelah mengetik. */
export function AutocompleteField<T>({
  value, onChange, onSelect, suggestions, renderLabel, renderSub, placeholder, inputClassName, disabled, noResultsText,
}: AutocompleteFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const showNoResults = open && !disabled && suggestions.length === 0 && value.trim().length > 0;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={inputClassName || "w-full border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-sm focus:outline-none focus:border-[#C99A36] disabled:bg-gray-50"}
      />
      {!disabled && (
        <svg
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-transform pointer-events-none ${open ? "rotate-180 text-[#C99A36]" : "text-gray-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <p className="text-sm font-semibold text-gray-800">{renderLabel(s)}</p>
              {renderSub && <p className="text-xs text-gray-400">{renderSub(s)}</p>}
            </button>
          ))}
        </div>
      )}
      {showNoResults && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-sm text-gray-400">
          {noResultsText || "Tidak ditemukan."}
        </div>
      )}
    </div>
  );
}
