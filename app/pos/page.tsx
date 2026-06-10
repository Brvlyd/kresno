import AppLayout from "@/components/AppLayout";

const produkTersedia = [
  { id: "INV001", nama: "Gelang 22K – 10gr", harga: 2800000 },
  { id: "INV002", nama: "Kalung 18K – 8gr", harga: 2240000 },
  { id: "INV003", nama: "Cincin 24K – 3gr", harga: 840000 },
  { id: "INV006", nama: "Gelang 24K – 15gr", harga: 4200000 },
  { id: "INV007", nama: "Cincin Berlian 18K – 4gr", harga: 5500000 },
  { id: "INV008", nama: "Liontin 18K – 5gr", harga: 1400000 },
];

const cartItems = [
  { nama: "Gelang 22K – 10gr", qty: 1, harga: 2800000 },
  { nama: "Cincin 24K – 3gr", qty: 2, harga: 840000 },
];

const subtotal = cartItems.reduce((sum, i) => sum + i.harga * i.qty, 0);

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function POSPage() {
  return (
    <AppLayout title="Point of Sale" subtitle="Transaksi penjualan">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Product Grid */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <h3 className="text-xl font-bold text-gray-800">Pilih Barang</h3>
              <input
                type="search"
                placeholder="Cari barang..."
                className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#B8860B] w-64"
              />
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {produkTersedia.map((p) => (
                <button
                  key={p.id}
                  className="text-left p-5 border-2 border-gray-200 rounded-2xl hover:border-[#B8860B] hover:bg-amber-50 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      💍
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-gray-800 group-hover:text-[#B8860B] leading-tight">
                        {p.nama}
                      </p>
                      <p className="text-xl font-bold text-[#B8860B] mt-1">{formatRp(p.harga)}</p>
                    </div>
                    <span className="text-2xl text-gray-300 group-hover:text-[#B8860B]">+</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">🛒 Keranjang</h3>
            </div>

            {/* Cart Items */}
            <div className="p-6 space-y-4 max-h-72 overflow-y-auto">
              {cartItems.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-800 truncate">{item.nama}</p>
                    <p className="text-[#B8860B] font-bold">{formatRp(item.harga)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="w-9 h-9 bg-gray-200 rounded-lg text-lg font-bold hover:bg-gray-300 transition-colors">−</button>
                    <span className="text-lg font-bold w-8 text-center">{item.qty}</span>
                    <button className="w-9 h-9 bg-gray-200 rounded-lg text-lg font-bold hover:bg-gray-300 transition-colors">+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="px-6 py-4 border-t border-gray-100 space-y-3">
              <div className="flex justify-between text-lg text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold">{formatRp(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg text-gray-600">
                <span>Diskon</span>
                <span className="text-green-600 font-semibold">-Rp 0</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-gray-800 pt-3 border-t border-gray-200">
                <span>Total</span>
                <span className="text-[#B8860B]">{formatRp(subtotal)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="px-6 pb-4">
              <p className="text-base font-semibold text-gray-700 mb-3">Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {["Tunai", "Transfer", "QRIS"].map((m) => (
                  <button key={m} className="py-3 border-2 border-gray-200 rounded-xl text-base font-medium hover:border-[#B8860B] hover:bg-amber-50 transition-all">
                    {m}
                  </button>
                ))}
              </div>
              <button className="w-full bg-[#B8860B] hover:bg-[#9A7209] text-white text-xl font-bold py-5 rounded-2xl transition-colors shadow-lg">
                💳 Proses Pembayaran
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
