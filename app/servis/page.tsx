import AppLayout from "@/components/AppLayout";

const servisData = [
  { id: "SRV001", pelanggan: "Rina Wati", barang: "Cincin rusak tali", jenis: "Perbaikan", tgl: "05 Jun 2025", estimasi: "08 Jun 2025", biaya: "Rp 150.000", status: "Selesai" },
  { id: "SRV002", pelanggan: "Hendra Gunawan", barang: "Kalung — sambung putus", jenis: "Penyambungan", tgl: "07 Jun 2025", estimasi: "10 Jun 2025", biaya: "Rp 200.000", status: "Dalam Proses" },
  { id: "SRV003", pelanggan: "Yuli Astuti", barang: "Gelang ukir motif", jenis: "Pengukiran", tgl: "08 Jun 2025", estimasi: "12 Jun 2025", biaya: "Rp 350.000", status: "Dalam Proses" },
  { id: "SRV004", pelanggan: "Bapak Sujoko", barang: "Anting bengkok", jenis: "Perbaikan", tgl: "09 Jun 2025", estimasi: "11 Jun 2025", biaya: "Rp 100.000", status: "Menunggu" },
];

const statsServis = [
  { label: "Dalam Proses", value: "7", icon: "🔧" },
  { label: "Selesai Hari Ini", value: "3", icon: "✅" },
  { label: "Menunggu Diambil", value: "2", icon: "⏳" },
  { label: "Total Pendapatan Servis", value: "Rp 1.2jt", icon: "💰" },
];

export default function ServisPage() {
  return (
    <AppLayout title="Servis & Perbaikan" subtitle="Kelola servis perhiasan pelanggan">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statsServis.map((s, i) => (
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
          <h3 className="text-xl font-bold text-gray-800">Daftar Servis</h3>
          <div className="flex gap-3 flex-wrap">
            <select className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#6F5333]">
              <option>Semua Status</option>
              <option>Dalam Proses</option>
              <option>Selesai</option>
              <option>Menunggu</option>
            </select>
            <button className="bg-[#6F5333] hover:bg-[#5A4228] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
              + Terima Servis Baru
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "Pelanggan", "Barang", "Jenis Servis", "Tgl Masuk", "Estimasi Selesai", "Biaya", "Status", "Aksi"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {servisData.map((s) => (
                <tr key={s.id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-6 py-4 text-base text-gray-500 font-mono">{s.id}</td>
                  <td className="px-6 py-4 text-lg font-medium text-gray-800 whitespace-nowrap">{s.pelanggan}</td>
                  <td className="px-6 py-4 text-base text-gray-700">{s.barang}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{s.jenis}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{s.tgl}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{s.estimasi}</td>
                  <td className="px-6 py-4 text-base font-semibold text-gray-800">{s.biaya}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      s.status === "Selesai" ? "bg-green-100 text-green-700" :
                      s.status === "Dalam Proses" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-100 transition-colors">
                        Detail
                      </button>
                      {s.status === "Selesai" && (
                        <button className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-base font-medium hover:bg-green-100 transition-colors whitespace-nowrap">
                          Serahkan
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
