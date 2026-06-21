"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RESET_PASSWORD_EMAIL } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function kirimOtp() {
    setSending(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email: RESET_PASSWORD_EMAIL });
    setSending(false);
    if (error) {
      setError("Gagal mengirim kode: " + error.message);
      return;
    }
    router.push("/otp");
  }

  return (
    <div className="min-h-screen bg-[#1C1C2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#6F5333] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-500 text-lg mt-2">Kode OTP akan dikirim ke email toko</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg bg-gray-50 text-gray-600">
              {RESET_PASSWORD_EMAIL}
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-base font-semibold bg-red-50 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            onClick={kirimOtp}
            disabled={sending}
            className="w-full bg-[#6F5333] hover:bg-[#5A4228] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg disabled:opacity-60"
          >
            {sending ? "Mengirim..." : "Kirim Kode OTP"}
          </button>

          <div className="text-center">
            <a href="/login" className="text-[#6F5333] text-lg hover:underline font-medium">
              ← Kembali ke Halaman Masuk
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
