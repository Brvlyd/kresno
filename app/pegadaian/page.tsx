import AppLayout from "@/components/AppLayout";

const gadaiData = [
  { id: "G001", pelanggan: "Budi Santoso", barang: "Gelang 22K – 10gr", nilai: "Rp 2.500.000", tgl: "01 Jun 2025", jatuh: "01 Agu 2025", bunga: "2%/bln", status: "Aktif" },
  { id: "G002", pelanggan: "Siti Rahayu", barang: "Kalung 18K – 15gr", nilai: "Rp 3.200.000", tgl: "15 Mei 2025", jatuh: "15 Jul 2025", bunga: "2%/bln", status: "Jatuh Tempo" },
  { id: "G003", pelanggan: "Ahmad Fauzi", barang: "Cincin Berlian 18K", nilai: "Rp 4.800.000", tgl: "20 Apr 2025", jatuh: "20 Jun 2025", bunga: "2%/bln", status: "Lunas" },
  { id: "G004", pelanggan: "Dewi Lestari", barang: "Anting Emas 22K", nilai: "Rp 1.200.000", tgl: "05 Jun 2025", jatuh: "05 Agu 2025", bunga: "2%/bln", status: "Aktif" },
];

const statsGadai = [
  { label: "Total Gadai Aktif", value: "12", icon: "📌" },
  { label: "Jatuh Tempo Bulan Ini", value: "4", icon: "⚠️" },
  { label: "Total Nilai Gadai", value: "Rp 42 jt", icon: "💰" },
  { label: "Sudah Lunas", value: "28", icon: "✅" },
];

export default function PegadaianPage() {
  return (
    <AppLayout title="Pegadaian" subtitle="Kelola pengajuan dan pelunasan gadai">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statsGadai.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <p className="text-3xl font-bold text-gray-800">{s.value}</p>
              <p className="text-gray-500 text-base">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-bold text-gray-800">Daftar Gadai</h3>
          <div className="flex gap-3">
            <input
              type="search"
              placeholder="Cari pelanggan..."
              className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#B8860B] w-56"
            />
            <button className="bg-[#B8860B] hover:bg-[#9A7209] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
              + Pengajuan Baru
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "Pelanggan", "Barang Gadai", "Nilai", "Tgl Gadai", "Jatuh Tempo", "Bunga", "Status", "Aksi"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gadaiData.map((g) => (
                <tr key={g.id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-6 py-4 text-base text-gray-500 font-mono">{g.id}</td>
                  <td className="px-6 py-4 text-lg font-medium text-gray-800 whitespace-nowrap">{g.pelanggan}</td>
                  <td className="px-6 py-4 text-base text-gray-700 whitespace-nowrap">{g.barang}</td>
                  <td className="px-6 py-4 text-base font-semibold text-gray-800 whitespace-nowrap">{g.nilai}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{g.tgl}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{g.jatuh}</td>
                  <td className="px-6 py-4 text-base text-gray-600">{g.bunga}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      g.status === "Aktif" ? "bg-blue-100 text-blue-700" :
                      g.status === "Jatuh Tempo" ? "bg-red-100 text-red-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-100 transition-colors whitespace-nowrap">
                        Lihat
                      </button>
                      {g.status !== "Lunas" && (
                        <button className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-base font-medium hover:bg-green-100 transition-colors whitespace-nowrap">
                          Lunasi
                        </button>
                      )}
                    </div>
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
