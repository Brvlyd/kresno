import AppLayout from "@/components/AppLayout";

const transactions = [
  { tgl: "10 Jun 2025", keterangan: "Penjualan Kalung 18K", jenis: "Pemasukan", jumlah: "+Rp 2.240.000" },
  { tgl: "10 Jun 2025", keterangan: "Pembelian Emas Batangan 50gr", jenis: "Pengeluaran", jumlah: "-Rp 14.000.000" },
  { tgl: "09 Jun 2025", keterangan: "Penjualan Cincin 24K", jenis: "Pemasukan", jumlah: "+Rp 840.000" },
  { tgl: "09 Jun 2025", keterangan: "Biaya Servis Cincin", jenis: "Pemasukan", jumlah: "+Rp 150.000" },
  { tgl: "08 Jun 2025", keterangan: "Pelunasan Gadai Gelang", jenis: "Pengeluaran", jumlah: "-Rp 3.500.000" },
  { tgl: "08 Jun 2025", keterangan: "Penjualan Anting 22K", jenis: "Pemasukan", jumlah: "+Rp 560.000" },
];

const summaryCards = [
  { label: "Pemasukan Bulan Ini", value: "Rp 24.500.000", icon: "📈", color: "border-l-green-500" },
  { label: "Pengeluaran Bulan Ini", value: "Rp 17.500.000", icon: "📉", color: "border-l-red-500" },
  { label: "Laba Bersih", value: "Rp 7.000.000", icon: "💹", color: "border-l-[#B8860B]" },
  { label: "Saldo Kas", value: "Rp 35.200.000", icon: "🏦", color: "border-l-blue-500" },
];

export default function KeuanganPage() {
  return (
    <AppLayout title="Keuangan" subtitle="Laporan keuangan toko">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((c, i) => (
          <div key={i} className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 ${c.color}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{c.icon}</span>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-1">{c.value}</p>
            <p className="text-gray-500 text-base">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter & Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h3>
          <div className="flex gap-3 flex-wrap">
            <select className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#B8860B]">
              <option>Semua Jenis</option>
              <option>Pemasukan</option>
              <option>Pengeluaran</option>
            </select>
            <select className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#B8860B]">
              <option>Juni 2025</option>
              <option>Mei 2025</option>
              <option>April 2025</option>
            </select>
            <button className="bg-[#B8860B] hover:bg-[#9A7209] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors">
              📊 Ekspor Laporan
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Tanggal", "Keterangan", "Jenis", "Jumlah"].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-base font-semibold text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t, i) => (
                <tr key={i} className="hover:bg-amber-50 transition-colors">
                  <td className="px-8 py-4 text-base text-gray-500 whitespace-nowrap">{t.tgl}</td>
                  <td className="px-8 py-4 text-lg text-gray-800">{t.keterangan}</td>
                  <td className="px-8 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      t.jenis === "Pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {t.jenis}
                    </span>
                  </td>
                  <td className={`px-8 py-4 text-xl font-bold ${
                    t.jumlah.startsWith("+") ? "text-green-600" : "text-red-600"
                  }`}>
                    {t.jumlah}
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
