import AppLayout from "@/components/AppLayout";

const hutangData = [
  { id: "HP001", nama: "Bu Sari", jenis: "Piutang", keterangan: "Pelunasan cicilan gelang", jumlah: "Rp 500.000", tgl: "01 Jun 2025", jatuh: "15 Jun 2025", status: "Belum Lunas" },
  { id: "HP002", nama: "Pak Dedi", jenis: "Hutang", keterangan: "Hutang bahan emas ke supplier", jumlah: "Rp 5.000.000", tgl: "20 Mei 2025", jatuh: "20 Jun 2025", status: "Belum Lunas" },
  { id: "HP003", nama: "Bu Tini", jenis: "Piutang", keterangan: "Cicilan kalung 3 bulan", jumlah: "Rp 750.000", tgl: "01 Mei 2025", jatuh: "01 Jun 2025", status: "Lunas" },
  { id: "HP004", nama: "Pak Andi", jenis: "Piutang", keterangan: "Sisa pembayaran cincin berlian", jumlah: "Rp 1.200.000", tgl: "05 Jun 2025", jatuh: "05 Jul 2025", status: "Belum Lunas" },
];

const statsHP = [
  { label: "Total Piutang", value: "Rp 8.5 jt", icon: "📥", color: "border-l-blue-500" },
  { label: "Total Hutang", value: "Rp 12 jt", icon: "📤", color: "border-l-red-500" },
  { label: "Jatuh Tempo Bulan Ini", value: "5", icon: "⚠️", color: "border-l-yellow-500" },
  { label: "Sudah Lunas", value: "18", icon: "✅", color: "border-l-green-500" },
];

export default function HutangPiutangPage() {
  return (
    <AppLayout title="Hutang & Piutang" subtitle="Kelola transaksi hutang dan piutang">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statsHP.map((s, i) => (
          <div key={i} className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 ${s.color} flex items-center gap-4`}>
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
          <h3 className="text-xl font-bold text-gray-800">Daftar Hutang & Piutang</h3>
          <div className="flex gap-3 flex-wrap">
            <select className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#6F5333]">
              <option>Semua Jenis</option>
              <option>Hutang</option>
              <option>Piutang</option>
            </select>
            <button className="bg-[#6F5333] hover:bg-[#5A4228] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
              + Tambah Transaksi
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "Nama", "Jenis", "Keterangan", "Jumlah", "Tgl Transaksi", "Jatuh Tempo", "Status", "Aksi"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hutangData.map((h) => (
                <tr key={h.id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-6 py-4 text-base text-gray-500 font-mono">{h.id}</td>
                  <td className="px-6 py-4 text-lg font-medium text-gray-800 whitespace-nowrap">{h.nama}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      h.jenis === "Piutang" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {h.jenis}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-base text-gray-700 max-w-xs">{h.keterangan}</td>
                  <td className="px-6 py-4 text-base font-bold text-gray-800 whitespace-nowrap">{h.jumlah}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{h.tgl}</td>
                  <td className="px-6 py-4 text-base text-gray-600 whitespace-nowrap">{h.jatuh}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      h.status === "Lunas" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-100 transition-colors">
                        Detail
                      </button>
                      {h.status !== "Lunas" && (
                        <button className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-base font-medium hover:bg-green-100 transition-colors whitespace-nowrap">
                          Tandai Lunas
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
