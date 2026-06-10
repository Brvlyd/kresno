import AppLayout from "@/components/AppLayout";

const statsCards = [
  { label: "Total Pendapatan Hari Ini", value: "Rp 8.450.000", icon: "💰", change: "+12%", positive: true },
  { label: "Total Penjualan", value: "23 Transaksi", icon: "🛒", change: "+5%", positive: true },
  { label: "Stok Emas", value: "1.250 gram", icon: "💎", change: "-2%", positive: false },
  { label: "Servis Dalam Proses", value: "7 Item", icon: "🔧", change: "+3", positive: true },
];

const recentInventory = [
  { no: 1, nama: "Gelang 22K – 10gr", harga: "Rp 2.800.000", stok: 5, status: "Tersedia" },
  { no: 2, nama: "Kalung 18K – 8gr", harga: "Rp 2.240.000", stok: 3, status: "Tersedia" },
  { no: 3, nama: "Cincin 24K – 3gr", harga: "Rp 840.000", stok: 12, status: "Tersedia" },
  { no: 4, nama: "Anting 22K – 2gr", harga: "Rp 560.000", stok: 1, status: "Menipis" },
  { no: 5, nama: "Liontin 18K – 5gr", harga: "Rp 1.400.000", stok: 0, status: "Habis" },
];

export default function DashboardPage() {
  return (
    <AppLayout title="Dashboard" subtitle="Selamat datang di Panel Manajer">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {statsCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-3xl">
                {card.icon}
              </div>
              <span className={`text-base font-semibold px-3 py-1 rounded-full ${
                card.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {card.change}
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800 mb-2">{card.value}</p>
            <p className="text-gray-500 text-base">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Harga Emas Banner */}
      <div className="rounded-2xl p-6 mb-8 flex items-center justify-between shadow-lg" style={{ background: "linear-gradient(135deg, #6F5333 0%, #8A6840 100%)" }}>
        <div>
          <p className="text-amber-100 text-lg font-medium">Harga Emas Hari Ini</p>
          <p className="text-white text-4xl font-bold mt-1">Rp 2.800.000 <span className="text-2xl font-normal">/gram</span></p>
          <p className="text-amber-200 text-base mt-1">Diperbarui: Hari ini, 08:00 WIB</p>
        </div>
        <div className="text-6xl opacity-30">💍</div>
      </div>

      {/* Inventori Terbaru */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Inventori Terbaru</h3>
          <a href="/inventori" className="text-[#6F5333] text-base font-semibold hover:underline">
            Lihat Semua →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["No", "Nama Barang", "Harga", "Stok", "Status"].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentInventory.map((item) => (
                <tr key={item.no} className="hover:bg-amber-50 transition-colors">
                  <td className="px-8 py-4 text-lg text-gray-600">{item.no}</td>
                  <td className="px-8 py-4 text-lg font-medium text-gray-800">{item.nama}</td>
                  <td className="px-8 py-4 text-lg text-gray-700">{item.harga}</td>
                  <td className="px-8 py-4 text-lg text-gray-700">{item.stok}</td>
                  <td className="px-8 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      item.status === "Tersedia" ? "bg-green-100 text-green-700" :
                      item.status === "Menipis" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {item.status}
                    </span>
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
