"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "kresno_last_activity";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
const CHECK_INTERVAL_MS = 15_000;
const WRITE_THROTTLE_MS = 2_000;

function readLastActivity(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : Date.now();
}

function markActivity() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

/**
 * Memantau klik/keyboard/scroll lewat localStorage (lintas tab) lalu memanggil
 * onIdle() begitu tidak ada aktivitas sama sekali selama `minutes` menit.
 * Dipakai untuk auto-logout global & lock PIN Keuangan — lock harus murni
 * berdasarkan idle sungguhan, bukan tiap kali komponen unmount/pindah halaman.
 */
export function useIdleTimeout(minutes: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    markActivity();

    let lastWrite = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      markActivity();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const thresholdMs = minutes * 60 * 1000;
    const interval = setInterval(() => {
      if (Date.now() - readLastActivity() >= thresholdMs) {
        clearInterval(interval);
        onIdleRef.current();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(interval);
    };
  }, [minutes]);
}
