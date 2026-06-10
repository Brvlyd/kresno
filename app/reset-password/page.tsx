export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#1C1C2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#B8860B] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-500 text-lg mt-2">Masukkan email terdaftar Anda</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="contoh@email.com"
              className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-[#B8860B] transition-colors"
            />
          </div>

          <button className="w-full bg-[#B8860B] hover:bg-[#9A7209] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg">
            Kirim Kode OTP
          </button>

          <div className="text-center">
            <a href="/login" className="text-[#B8860B] text-lg hover:underline font-medium">
              ← Kembali ke Halaman Masuk
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
