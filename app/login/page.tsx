export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1C1C2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#B8860B] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            💍
          </div>
          <h1 className="text-3xl font-bold text-gray-800">SITOMAS</h1>
          <p className="text-gray-500 text-lg mt-2">Sistem Toko Mas</p>
        </div>

        {/* PIN Input */}
        <div className="mb-8">
          <label className="block text-xl font-semibold text-gray-700 mb-3 text-center">
            Masukkan PIN Anda
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 text-3xl text-center tracking-[0.5em] font-bold focus:outline-none focus:border-[#B8860B] transition-colors text-gray-800 placeholder:text-gray-300"
          />
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => (
            <button
              key={i}
              className={`h-16 rounded-2xl text-2xl font-bold transition-all duration-150 ${
                key === ""
                  ? "bg-transparent cursor-default"
                  : key === "⌫"
                  ? "bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 border-2 border-red-200"
                  : "bg-gray-50 text-gray-800 hover:bg-[#B8860B] hover:text-white active:scale-95 border-2 border-gray-200 hover:border-[#B8860B]"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Tombol Masuk */}
        <a
          href="/dashboard"
          className="block w-full bg-[#B8860B] hover:bg-[#9A7209] text-white text-xl font-bold py-5 rounded-2xl text-center transition-colors shadow-lg active:scale-[0.99]"
        >
          Masuk
        </a>

        {/* Reset Password */}
        <div className="text-center mt-5">
          <a href="/reset-password" className="text-[#B8860B] text-lg hover:underline font-medium">
            Lupa PIN? Reset Password
          </a>
        </div>
      </div>
    </div>
  );
}
