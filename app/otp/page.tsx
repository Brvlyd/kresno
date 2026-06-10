export default function OTPPage() {
  return (
    <div className="min-h-screen bg-[#1C1C2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-amber-50 border-4 border-[#B8860B] rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
            📱
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Verifikasi OTP</h1>
          <p className="text-gray-500 text-lg mt-2">Kode OTP dikirim ke email Anda</p>
          <p className="text-[#B8860B] font-semibold text-base mt-1">c***@email.com</p>
        </div>

        {/* OTP Inputs */}
        <div className="flex gap-3 justify-center mb-8">
          {[1,2,3,4,5,6].map((i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="w-14 h-16 border-2 border-gray-200 rounded-2xl text-3xl font-bold text-center focus:outline-none focus:border-[#B8860B] transition-colors text-gray-800"
            />
          ))}
        </div>

        <button className="w-full bg-[#B8860B] hover:bg-[#9A7209] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg mb-5">
          Verifikasi
        </button>

        <div className="text-center space-y-3">
          <p className="text-gray-500 text-base">Belum menerima kode?</p>
          <button className="text-[#B8860B] text-lg font-semibold hover:underline">
            Kirim Ulang (60 detik)
          </button>
          <div className="pt-2">
            <a href="/login" className="text-gray-500 text-base hover:underline">
              ← Kembali ke Masuk
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
