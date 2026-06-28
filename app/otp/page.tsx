"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RESET_PASSWORD_EMAIL } from "@/lib/auth";

export default function OTPPage() {
  const router = useRouter();
  const supabase = createClient();
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [step, setStep] = useState<"verify" | "set-password">("verify");
  const [digits, setDigits] = useState(["", "", "", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function setDigit(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 7) inputsRef.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  async function verifikasi() {
    const code = digits.join("");
    if (code.length !== 8) {
      setMsg({ type: "err", text: "Masukkan 8 digit kode OTP." });
      return;
    }
    setVerifying(true);
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({
      email: RESET_PASSWORD_EMAIL, token: code, type: "email",
    });
    setVerifying(false);
    if (error) {
      setMsg({ type: "err", text: "Kode salah atau sudah kedaluwarsa: " + error.message });
      return;
    }
    setStep("set-password");
  }

  async function resendCode() {
    setResending(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: RESET_PASSWORD_EMAIL });
    setResending(false);
    if (error) {
      setMsg({ type: "err", text: "Gagal mengirim ulang kode: " + error.message });
      return;
    }
    setCooldown(60);
    setMsg({ type: "ok", text: "Kode baru telah dikirim." });
  }

  async function simpanPassword() {
    if (newPassword.length < 6) {
      setMsg({ type: "err", text: "Password baru minimal 6 angka." });
      return;
    }
    if (!/^\d+$/.test(newPassword)) {
      setMsg({ type: "err", text: "Password hanya boleh angka." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "err", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setSaving(true);
    setMsg(null);
    // Set password akun Supabase Auth toko ini — inilah yang benar-benar dipakai
    // untuk login (lihat app/login/page.tsx). Sesi OTP yang masih aktif di sini
    // adalah satu-satunya cara mengganti password tanpa service role key.
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      setSaving(false);
      setMsg({ type: "err", text: "Gagal menyimpan password baru: " + authError.message });
      return;
    }
    const { error } = await supabase
      .from("login_password")
      .update({ password: newPassword, updated_at: new Date().toISOString() })
      .eq("id", 1);
    await supabase.auth.signOut();
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: "Gagal menyimpan password baru: " + error.message });
      return;
    }
    setMsg({ type: "ok", text: "Password berhasil direset!" });
    setTimeout(() => router.push("/login"), 900);
  }

  return (
    <div className="min-h-screen bg-[#1C1C2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-amber-50 border-4 border-[#6F5333] rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
            📱
          </div>
          <h1 className="text-3xl font-bold text-gray-800">
            {step === "verify" ? "Verifikasi OTP" : "Buat Password Baru"}
          </h1>
          {step === "verify" && (
            <>
              <p className="text-gray-500 text-lg mt-2">Kode OTP dikirim ke email Anda</p>
              <p className="text-[#6F5333] font-semibold text-base mt-1">{RESET_PASSWORD_EMAIL}</p>
            </>
          )}
        </div>

        {step === "verify" ? (
          <>
            {/* OTP Inputs */}
            <div className="flex gap-2 justify-center mb-8">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-9 h-14 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#6F5333] transition-colors text-gray-800"
                />
              ))}
            </div>

            {msg && (
              <p className={`mb-5 text-sm font-semibold py-2 px-3 rounded-lg ${
                msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>{msg.text}</p>
            )}

            <button
              onClick={verifikasi}
              disabled={verifying}
              className="w-full bg-[#6F5333] hover:bg-[#5A4228] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg mb-5 disabled:opacity-60"
            >
              {verifying ? "Memverifikasi..." : "Verifikasi"}
            </button>

            <div className="text-center space-y-3">
              <p className="text-gray-500 text-base">Belum menerima kode?</p>
              <button
                onClick={resendCode}
                disabled={cooldown > 0 || resending}
                className="text-[#6F5333] text-lg font-semibold hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {cooldown > 0 ? `Kirim Ulang (${cooldown} detik)` : resending ? "Mengirim..." : "Kirim Ulang"}
              </button>
              <div className="pt-2">
                <a href="/login" className="text-gray-500 text-base hover:underline">
                  ← Kembali ke Masuk
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-5">
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-2">
                  Password Baru (minimal 6 angka)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ""))}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg text-center tracking-[0.4em] focus:outline-none focus:border-[#6F5333] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xl font-semibold text-gray-700 mb-2">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ""))}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg text-center tracking-[0.4em] focus:outline-none focus:border-[#6F5333] transition-colors"
                />
              </div>

              {msg && (
                <p className={`text-sm font-semibold py-2 px-3 rounded-lg ${
                  msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}>{msg.text}</p>
              )}

              <button
                onClick={simpanPassword}
                disabled={saving}
                className="w-full bg-[#6F5333] hover:bg-[#5A4228] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan Password"}
              </button>

              <div className="text-center">
                <a href="/login" className="text-gray-500 text-base hover:underline">
                  ← Kembali ke Masuk
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
