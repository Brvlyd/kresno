import AppLayout from "@/components/AppLayout";

const pembelianData = [
  { id: "PB001", supplier: "Toko Emas Sentosa", barang: "Emas Batangan 24K – 50gr", harga: "Rp 140.000.000", tgl: "01 Jun 2025", status: "Lunas" },
  { id: "PB002", supplier: "CV. Mulia Logam", barang: "Emas Batangan 22K – 20gr", harga: "Rp 56.000.000", tgl: "05 Jun 2025", status: "Lunas" },
  { id: "PB003", supplier: "PT. Prima Gold", barang: "Perhiasan Setengah Jadi – 30gr", harga: "Rp 75.000.000", tgl: "08 Jun 2025", status: "Pending" },
  { id: "PB004", supplier: "Toko Emas Sentosa", barang: "Emas Batangan 24K – 100gr", harga: "Rp 280.000.000", tgl: "10 Jun 2025", status: "Pending" },
];

const statsPembelian = [
  { label: "Pembelian Bulan Ini", value: "8 Transaksi", icon: "🛍️" },
  { label: "Total Nilai", value: "Rp 551 jt", icon: "💰" },
  { label: "Menunggu Konfirmasi", value: "2", icon: "⏳" },
  { label: "Supplier Aktif", value: "6", icon: "🏪" },
];

export default function PembelianPage() {
  return (
    <AppLayout title="Pembelian" subtitle="Kelola pembelian stok emas">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statsPembelian.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-gray-500 text-base">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-bold text-gray-800">Riwayat Pembelian</h3>
          <button className="bg-[#B8860B] hover:bg-[#9A7209] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
            + Buat Pesanan Baru
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "Supplier", "Barang", "Harga", "Tanggal", "Status", "Aksi"].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pembelianData.map((p) => (
                <tr key={p.id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-8 py-4 text-base text-gray-500 font-mono">{p.id}</td>
                  <td className="px-8 py-4 text-lg font-medium text-gray-800 whitespace-nowrap">{p.supplier}</td>
                  <td className="px-8 py-4 text-base text-gray-700">{p.barang}</td>
                  <td className="px-8 py-4 text-base font-semibold text-gray-800 whitespace-nowrap">{p.harga}</td>
                  <td className="px-8 py-4 text-base text-gray-600 whitespace-nowrap">{p.tgl}</td>
                  <td className="px-8 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      p.status === "Lunas" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-100 transition-colors">
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
