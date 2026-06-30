"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { verifyAksesPin, isAksesUnlocked, lockAksesSensitif } from "@/lib/aksesSensitif";
import { useIdleTimeout } from "@/lib/useIdleTimeout";

/** Lock PIN berlaku lagi kalau benar-benar idle (tanpa klik/keyboard/scroll) selama ini. */
const IDLE_LOCK_MINUTES = 30;

const DEFAULT_PIN = "1234";
/** Email tujuan kode reset PIN — kotak masuk toko, bukan email pegawai perorangan. */
const RESET_PIN_EMAIL = "tokomaskresno5758@gmail.com";

/* ═══════════════════════════════════════════════════════
   KOMPONEN: PIN LOCK SCREEN
═══════════════════════════════════════════════════════ */
function PinLockScreen({
  pageTitle, storedPin, onUnlock, onPinReset,
}: {
  pageTitle: string;
  storedPin: string;
  onUnlock: () => void;
  onPinReset: (newPin: string) => void;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pinLen = storedPin.length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function tryPin(p: string) {
    const ok = await verifyAksesPin(p);
    if (ok) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => { setPin(""); setError(false); setShake(false); inputRef.current?.focus(); }, 900);
    }
  }

  function addDigit(d: string) {
    if (error) return;
    const next = pin + d;
    if (next.length > pinLen) return;
    setPin(next);
    if (next.length === pinLen) setTimeout(() => tryPin(next), 80);
  }

  function handleTyped(raw: string) {
    if (error) return;
    const digits = raw.replace(/\D/g, "").slice(0, pinLen);
    setPin(digits);
    if (digits.length === pinLen) setTimeout(() => tryPin(digits), 80);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-4"
      style={{ backgroundColor: "#6F5333" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Input asli supaya PIN bisa diketik via keyboard fisik, disamarkan di atas titik-titik PIN */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => handleTyped(e.target.value)}
        className="absolute opacity-0 w-px h-px"
        aria-label="Masukkan PIN"
      />
      {/* Tombol Kembali */}
      <button
        onClick={() => router.back()}
        className="absolute top-5 left-5 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Kembali
      </button>

      {/* Logo */}
      <Image
        src="/logo-kresno.png"
        alt="Toko Mas Kresno"
        width={150}
        height={175}
        priority
        className="object-contain drop-shadow-2xl"
      />

      {/* Judul */}
      <div className="text-center">
        <h2 className="text-white text-2xl font-extrabold tracking-wide">
          {pageTitle}
        </h2>
        <p className="text-white/70 text-sm mt-1">
          Masukkan PIN untuk melanjutkan
        </p>
      </div>

      {/* Titik-titik PIN */}
      <div className={`flex gap-3 ${shake ? "animate-bounce" : ""}`}>
        {Array.from({ length: pinLen }, (_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              error
                ? "border-red-400 bg-red-400"
                : i < pin.length
                  ? "border-white bg-white"
                  : "border-white/50 bg-transparent"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-300 text-sm font-semibold -mt-2">
          PIN salah. Coba lagi.
        </p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button
            key={d}
            onClick={() => addDigit(d)}
            className="h-16 rounded-2xl text-white text-2xl font-bold transition-all active:scale-90"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => { if (!error) setPin(p => p.slice(0, -1)); }}
          className="h-16 rounded-2xl text-white/70 text-sm font-semibold transition-all active:scale-90"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          ← Hapus
        </button>
        <button
          onClick={() => addDigit("0")}
          className="h-16 rounded-2xl text-white text-2xl font-bold transition-all active:scale-90"
          style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
        >
          0
        </button>
        <div />
      </div>

      {/* Lupa PIN */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowForgotPin(true); }}
        className="text-sm font-semibold text-white/70 hover:text-white underline transition-colors"
      >
        Lupa PIN?
      </button>

      <ForgotPinModal
        open={showForgotPin}
        onClose={() => setShowForgotPin(false)}
        onReset={(newPin) => {
          onPinReset(newPin);
          setShowForgotPin(false);
          onUnlock();
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: LUPA PIN — kirim kode OTP ke email toko (lewat Supabase Auth),
   lalu set PIN baru kalau kodenya benar.
═══════════════════════════════════════════════════════ */
function ForgotPinModal({
  open, onClose, onReset,
}: {
  open: boolean;
  onClose: () => void;
  onReset: (newPin: string) => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setStep("request"); setCode(""); setNewPin(""); setConfirmPin("");
      setMsg(null); setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setSending(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: RESET_PIN_EMAIL });
    setSending(false);
    if (error) { setMsg({ type: "err", text: "Gagal mengirim kode: " + error.message }); return; }
    setStep("verify");
    setCooldown(60);
    setMsg({ type: "ok", text: `Kode telah dikirim ke ${RESET_PIN_EMAIL}.` });
  }

  async function resetPin() {
    if (!/^\d{4,10}$/.test(code)) { setMsg({ type: "err", text: "Kode dari email tidak valid." }); return; }
    if (newPin.length < 4) { setMsg({ type: "err", text: "PIN baru minimal 4 angka." }); return; }
    if (!/^\d+$/.test(newPin)) { setMsg({ type: "err", text: "PIN hanya boleh angka." }); return; }
    if (newPin !== confirmPin) { setMsg({ type: "err", text: "Konfirmasi PIN tidak cocok." }); return; }

    setVerifying(true); setMsg(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: RESET_PIN_EMAIL, token: code, type: "email",
    });
    if (verifyError) {
      setVerifying(false);
      setMsg({ type: "err", text: "Kode salah atau sudah kedaluwarsa: " + verifyError.message });
      return;
    }

    const { error: updateError } = await supabase
      .from("keuangan_pin")
      .update({ pin: newPin, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setVerifying(false);

    if (updateError) { setMsg({ type: "err", text: "Gagal menyimpan PIN baru: " + updateError.message }); return; }
    await verifyAksesPin(newPin); // set cookie unlock juga, biar konsisten dgn onUnlock() di bawah
    setMsg({ type: "ok", text: "PIN berhasil direset!" });
    setTimeout(() => onReset(newPin), 900);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Lupa PIN</h3>

        {step === "request" ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Kode reset akan dikirim ke email toko: <strong>{RESET_PIN_EMAIL}</strong>.
            </p>
            <button
              onClick={sendCode}
              disabled={sending}
              className="w-full py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#C99A36" }}
            >
              {sending ? "Mengirim..." : "Kirim Kode ke Email"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Masukkan kode dari email, lalu buat PIN baru.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Kode dari Email</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-[0.3em] focus:outline-none focus:border-[#C99A36]"
                  placeholder="Kode dari email"
                />
              </div>
              {(
                [
                  { label: "PIN Baru (minimal 4 angka)", val: newPin, set: setNewPin },
                  { label: "Konfirmasi PIN Baru", val: confirmPin, set: setConfirmPin },
                ] as { label: string; val: string; set: (v: string) => void }[]
              ).map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">{label}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={val}
                    onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-[#C99A36]"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={sendCode}
              disabled={cooldown > 0 || sending}
              className="text-sm font-semibold mt-3 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
              style={{ color: cooldown > 0 ? undefined : "#C99A36" }}
            >
              {cooldown > 0 ? `Kirim ulang kode (${cooldown}s)` : "Kirim ulang kode"}
            </button>
          </>
        )}

        {msg && (
          <p className={`mt-3 text-sm font-semibold py-2 px-3 rounded-lg ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>{msg.text}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          {step === "verify" && (
            <button
              onClick={resetPin}
              disabled={verifying}
              className="flex-1 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#C99A36" }}
            >
              {verifying ? "Memverifikasi..." : "Reset PIN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KOMPONEN: GANTI PIN MODAL
═══════════════════════════════════════════════════════ */
function ChangePinModal({ open, onClose, currentPin, onChanged }: {
  open: boolean;
  onClose: () => void;
  currentPin: string;
  onChanged: (newPin: string) => void;
}) {
  const supabase = createClient();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (open) { setOldPin(""); setNewPin(""); setConfirmPin(""); setMsg(null); }
  }, [open]);

  async function save() {
    if (oldPin !== currentPin) { setMsg({ type: "err", text: "PIN lama tidak sesuai." }); return; }
    if (newPin.length < 4) { setMsg({ type: "err", text: "PIN baru minimal 4 angka." }); return; }
    if (!/^\d+$/.test(newPin)) { setMsg({ type: "err", text: "PIN hanya boleh angka." }); return; }
    if (newPin !== confirmPin) { setMsg({ type: "err", text: "Konfirmasi PIN tidak cocok." }); return; }

    setSaving(true); setMsg(null);
    const { error } = await supabase
      .from("keuangan_pin")
      .update({ pin: newPin, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) { setMsg({ type: "err", text: "Gagal menyimpan PIN: " + error.message }); return; }
    onChanged(newPin);
    setMsg({ type: "ok", text: "PIN berhasil diubah!" });
    setTimeout(onClose, 1200);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Ganti PIN</h3>
        <p className="text-sm text-gray-500 mb-4">
          PIN ini melindungi halaman ini (dan halaman sensitif lainnya) dari akses pegawai biasa.
        </p>
        <div className="space-y-3">
          {(
            [
              { label: "PIN Lama", val: oldPin, set: setOldPin },
              { label: "PIN Baru (minimal 4 angka)", val: newPin, set: setNewPin },
              { label: "Konfirmasi PIN Baru", val: confirmPin, set: setConfirmPin },
            ] as { label: string; val: string; set: (v: string) => void }[]
          ).map(({ label, val, set }) => (
            <div key={label}>
              <label className="text-sm font-semibold text-gray-700 block mb-1">{label}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={val}
                onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-[#C99A36]"
              />
            </div>
          ))}
        </div>
        {msg && (
          <p className={`mt-3 text-sm font-semibold py-2 px-3 rounded-lg ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>{msg.text}</p>
        )}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#C99A36" }}
          >
            {saving ? "Menyimpan..." : "Simpan PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type PinGateControls = {
  lock: () => void;
  openChangePin: () => void;
};

/* ═══════════════════════════════════════════════════════
   EXPORT UTAMA — Gate PIN bersama untuk halaman sensitif
   (Keuangan, Inventori, Hutang-Piutang). Satu PIN, satu cookie unlock
   berlaku di seluruh path "/" — unlock di satu halaman ikut membuka
   halaman sensitif lainnya.
═══════════════════════════════════════════════════════ */
export default function PinGate({
  pageTitle, children,
}: {
  pageTitle: string;
  children: (controls: PinGateControls) => React.ReactNode;
}) {
  const supabase = createClient();
  const [unlocked, setUnlocked] = useState(false);
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pinLoaded, setPinLoaded] = useState(false);
  const [currentPin, setCurrentPin] = useState(DEFAULT_PIN);
  const [showChangePin, setShowChangePin] = useState(false);

  useEffect(() => {
    setMounted(true);
    isAksesUnlocked().then((v) => {
      setUnlocked(v);
      setUnlockChecked(true);
    });
    supabase
      .from("keuangan_pin")
      .select("pin")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.pin) setCurrentPin(data.pin);
        setPinLoaded(true);
      });

    // Kunci kalau tab/browser benar-benar ditutup atau di-refresh.
    const handlePageHide = () => { lockAksesSensitif(); setUnlocked(false); };
    window.addEventListener("pagehide", handlePageHide);

    // Kunci begitu tab ini disembunyikan — pindah ke tab lain, minimize,
    // atau kunci layar. Dicek lewat document.hidden, bukan blur, supaya
    // tidak ikut terkunci cuma karena klik ke devtools/jendela lain yang
    // masih di layar yang sama.
    const handleVisibility = () => {
      if (document.hidden) {
        lockAksesSensitif();
        setUnlocked(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Sinkronkan ulang status terkunci/tidak saat halaman ini dipulihkan dari
    // bfcache (mis. tekan Back browser) — tanpa ini, state React "unlocked"
    // di tab tersebut tetap beku di nilai lamanya meski cookie sudah dihapus
    // oleh pagehide di atas. Sama seperti pola di AuthGuard.
    const handlePageShow = () => {
      isAksesUnlocked().then((v) => {
        setUnlocked(v);
        setUnlockChecked(true);
      });
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      // Kunci juga saat keluar dari halaman ini lewat navigasi di dalam app
      // (klik menu lain di sidebar) — itu cuma unmount React, bukan reload,
      // jadi pagehide di atas tidak ikut terpanggil.
      lockAksesSensitif();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kunci ulang begitu benar-benar idle (tanpa klik/keyboard/scroll sama
  // sekali) selama IDLE_LOCK_MINUTES menit. Selama masih dipakai, tidak
  // akan terkunci.
  useIdleTimeout(IDLE_LOCK_MINUTES, () => {
    lockAksesSensitif();
    setUnlocked(false);
  });

  if (!mounted || !pinLoaded || !unlockChecked) return null;

  if (!unlocked) {
    return (
      <PinLockScreen
        pageTitle={pageTitle}
        storedPin={currentPin}
        onUnlock={() => setUnlocked(true)}
        onPinReset={setCurrentPin}
      />
    );
  }

  return (
    <>
      {children({
        lock: () => { lockAksesSensitif(); setUnlocked(false); },
        openChangePin: () => setShowChangePin(true),
      })}
      <ChangePinModal
        open={showChangePin}
        onClose={() => setShowChangePin(false)}
        currentPin={currentPin}
        onChanged={setCurrentPin}
      />
    </>
  );
}
