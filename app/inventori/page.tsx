import AppLayout from "@/components/AppLayout";

const items = [
  { id: "INV001", nama: "Gelang Emas 22K – 10gr", kategori: "Gelang", berat: "10gr", harga: "Rp 2.800.000", stok: 5, status: "Tersedia" },
  { id: "INV002", nama: "Kalung Emas 18K – 8gr", kategori: "Kalung", berat: "8gr", harga: "Rp 2.240.000", stok: 3, status: "Tersedia" },
  { id: "INV003", nama: "Cincin Emas 24K – 3gr", kategori: "Cincin", berat: "3gr", harga: "Rp 840.000", stok: 12, status: "Tersedia" },
  { id: "INV004", nama: "Anting Emas 22K – 2gr", kategori: "Anting", berat: "2gr", harga: "Rp 560.000", stok: 1, status: "Menipis" },
  { id: "INV005", nama: "Liontin Emas 18K – 5gr", kategori: "Liontin", berat: "5gr", harga: "Rp 1.400.000", stok: 0, status: "Habis" },
  { id: "INV006", nama: "Gelang Emas 24K – 15gr", kategori: "Gelang", berat: "15gr", harga: "Rp 4.200.000", stok: 2, status: "Menipis" },
  { id: "INV007", nama: "Cincin Berlian 18K – 4gr", kategori: "Cincin", berat: "4gr", harga: "Rp 5.500.000", stok: 7, status: "Tersedia" },
];

const statsData = [
  { label: "Total Item Stok", value: "12", icon: "📦", color: "bg-blue-50 text-blue-700" },
  { label: "Item Masuk Hari Ini", value: "+1", icon: "📥", color: "bg-green-50 text-green-700" },
  { label: "Item Keluar Hari Ini", value: "-4", icon: "📤", color: "bg-orange-50 text-orange-700" },
  { label: "Stok Menipis", value: "2", icon: "⚠️", color: "bg-yellow-50 text-yellow-700" },
];

export default function InventoriPage() {
  return (
    <AppLayout title="Inventori" subtitle="Kelola stok barang toko">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statsData.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <p className="text-3xl font-bold text-gray-800">{s.value}</p>
                <p className="text-gray-500 text-base">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-xl font-bold text-gray-800">Daftar Barang</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              type="search"
              placeholder="Cari barang..."
              className="border-2 border-gray-200 rounded-xl px-5 py-3 text-lg focus:outline-none focus:border-[#B8860B] w-64"
            />
            <button className="bg-[#B8860B] hover:bg-[#9A7209] text-white text-lg font-semibold px-6 py-3 rounded-xl transition-colors">
              + Tambah Barang
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "Nama Barang", "Kategori", "Berat", "Harga", "Stok", "Status", "Aksi"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-base font-semibold text-gray-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-6 py-4 text-base text-gray-500 font-mono">{item.id}</td>
                  <td className="px-6 py-4 text-lg font-medium text-gray-800 whitespace-nowrap">{item.nama}</td>
                  <td className="px-6 py-4 text-base text-gray-600">{item.kategori}</td>
                  <td className="px-6 py-4 text-base text-gray-600">{item.berat}</td>
                  <td className="px-6 py-4 text-base font-semibold text-gray-700">{item.harga}</td>
                  <td className="px-6 py-4 text-lg font-bold text-gray-800">{item.stok}</td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                      item.status === "Tersedia" ? "bg-green-100 text-green-700" :
                      item.status === "Menipis" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-100 transition-colors">
                        Ubah
                      </button>
                      <button className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-base font-medium hover:bg-red-100 transition-colors">
                        Hapus
                      </button>
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
