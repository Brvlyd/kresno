"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setLoggedIn } from "@/lib/auth-session";

const DEFAULT_PASSWORD = "1111";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [storedPassword, setStoredPassword] = useState(DEFAULT_PASSWORD);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showExpired, setShowExpired] = useState(searchParams.get("expired") === "1");

  useEffect(() => {
    supabase
      .from("login_password")
      .select("password")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data?.password) setStoredPassword(data.password);
      });
  }, [supabase]);

  function handleMasuk() {
    if (checking) return;
    setChecking(true);
    if (pin === storedPassword) {
      setLoggedIn();
      router.push("/dashboard");
    } else {
      setError(true);
      setChecking(false);
      setTimeout(() => { setPin(""); setError(false); inputRef.current?.focus(); }, 900);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
      style={{ backgroundColor: "#6F5333" }}
    >
      {/* Popup: sesi habis / harus login kembali (misal setelah logout lalu menekan tombol Back) */}
      {showExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" style={{ color: "#C99A36" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sesi Anda Telah Berakhir</h3>
            <p className="text-gray-500 text-base mb-6">
              Anda sudah logout. Silahkan login kembali untuk melanjutkan.
            </p>
            <button
              onClick={() => setShowExpired(false)}
              className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-colors"
              style={{ backgroundColor: "#C99A36" }}
            >
              Login Kembali
            </button>
          </div>
        </div>
      )}

      {/* Logo Kresno */}
      <div className="flex flex-col items-center">
        <Image
          src="/logo-kresno.png"
          alt="Logo Toko Mas Kresno"
          width={240}
          height={280}
          priority
          className="object-contain drop-shadow-2xl"
        />
      </div>

      {/* Form Area */}
      <div className="flex flex-col items-center w-full max-w-lg gap-6">
        {/* Label */}
        <p className="text-white text-2xl font-medium tracking-wide">
          Masukkan PIN Anda
        </p>

        {/* PIN Input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleMasuk(); }}
          autoFocus
          className={`w-full max-w-sm h-14 rounded-full bg-white px-6 text-2xl font-bold text-center text-gray-800 focus:outline-none focus:ring-4 shadow-lg transition-all ${
            error ? "ring-4 ring-red-400" : "focus:ring-white/50"
          }`}
        />

        {error && (
          <p className="text-red-300 text-sm font-semibold -mt-2">
            PIN salah. Coba lagi.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-6 mt-2">
          {/* Masuk — bold */}
          <button
            onClick={handleMasuk}
            disabled={checking}
            className="min-w-[160px] h-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: "#FFFBE9", color: "#6F5333", border: "2px solid #C4A35A" }}
          >
            Masuk
          </button>

          {/* Reset Password */}
          <Link
            href="/reset-password"
            className="min-w-[200px] h-14 rounded-2xl flex items-center justify-center text-xl font-normal transition-all shadow-md active:scale-95"
            style={{ backgroundColor: "#FFFBE9", color: "#6F5333", border: "2px solid #C4A35A" }}
          >
            Reset Password
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
