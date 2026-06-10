import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
      style={{ backgroundColor: "#6F5333" }}
    >
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
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder=""
          className="w-full max-w-sm h-14 rounded-full bg-white px-6 text-2xl font-bold text-center text-gray-800 focus:outline-none focus:ring-4 focus:ring-white/50 shadow-lg"
        />

        {/* Buttons */}
        <div className="flex gap-6 mt-2">
          {/* Masuk — bold */}
          <Link
            href="/dashboard"
            className="min-w-[160px] h-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-all shadow-md active:scale-95"
            style={{ backgroundColor: "#FFFBE9", color: "#6F5333", border: "2px solid #C4A35A" }}
          >
            Masuk
          </Link>

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
