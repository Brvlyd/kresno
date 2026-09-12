import {
  hitungHargaDariPersentase,
  hitungModalPerUnit,
  patokanModal24K,
} from "@/lib/hargaEmas";

/* Kasus nyata yang memicu perbaikan ini — INV-20260906-2374, KALUNG MILANO:
   5,05 gr, persen modal 44%, persen jual 51%, diskon Rp 100.000.
   Harga emas 24K saat barang DIINPUT 1.056.000/gr, saat DIJUAL 2.450.000/gr. */
const BERAT = 5.05;
const PERSEN_MODAL = 44;
const PERSEN_JUAL = 51;
const HARGA_24K_SAAT_INPUT = 1_056_000;
const HARGA_24K_SAAT_JUAL = 2_450_000;
const DISKON = 100_000;

describe("hitungHargaDariPersentase", () => {
  it("menghitung harga jual dari berat x persentase x patokan 24K", () => {
    expect(hitungHargaDariPersentase(BERAT, PERSEN_JUAL, HARGA_24K_SAAT_JUAL)).toBe(6_309_975);
  });

  it("menghitung modal dengan patokan 24K yang sama", () => {
    expect(hitungHargaDariPersentase(BERAT, PERSEN_MODAL, HARGA_24K_SAAT_JUAL)).toBe(5_443_900);
  });

  it("selalu patokan 24K — kadar barang tidak ikut mengecilkan harga", () => {
    // Barang 8K tetap dihitung penuh dari harga 24K; persentase-lah yang
    // menanggung selisih kadar. Kalau suatu saat dibagi 24/karat, test ini gagal.
    expect(hitungHargaDariPersentase(1, 100, 2_450_000)).toBe(2_450_000);
  });
});

describe("patokanModal24K", () => {
  it("memakai harga_beli kalau terisi", () => {
    expect(patokanModal24K({ harga_beli: 2_400_000, harga_jual: 2_450_000 })).toBe(2_400_000);
  });

  it("jatuh ke harga_jual kalau harga_beli lupa diisi", () => {
    // Tanpa cadangan ini modal jadi Rp 0 dan laba kotor = 100% harga jual.
    expect(patokanModal24K({ harga_beli: 0, harga_jual: 2_450_000 })).toBe(2_450_000);
  });

  it("null kalau harga emas hari itu belum diisi sama sekali", () => {
    expect(patokanModal24K(null)).toBeNull();
    expect(patokanModal24K({ harga_beli: 0, harga_jual: 0 })).toBeNull();
  });
});

describe("laba kotor penjualan", () => {
  const labaKotor = (hargaJual: number, modal: number, qty = 1) =>
    hargaJual * qty - DISKON - modal * qty;

  it("modal sepatokan dgn harga jual — laba = selisih persen jual vs persen modal", () => {
    const hargaJual = hitungHargaDariPersentase(BERAT, PERSEN_JUAL, HARGA_24K_SAAT_JUAL);
    const modal = hitungModalPerUnit(BERAT, PERSEN_MODAL, HARGA_24K_SAAT_JUAL, 0);
    expect(labaKotor(hargaJual, modal)).toBe(766_075);
  });

  it("REGRESI: modal dari harga emas hari input membuat laba membengkak", () => {
    // Perilaku LAMA yang dilaporkan sbg bug — modal dari kolom inventori.harga_beli
    // yang dihitung saat barang diinput, sementara harga jual pakai harga hari ini.
    const hargaJual = hitungHargaDariPersentase(BERAT, PERSEN_JUAL, HARGA_24K_SAAT_JUAL);
    const modalLama = hitungHargaDariPersentase(BERAT, PERSEN_MODAL, HARGA_24K_SAAT_INPUT);
    expect(labaKotor(hargaJual, modalLama)).toBe(3_863_543);

    // Selisih keduanya = kenaikan harga emas selama barang mengendap di etalase,
    // bukan margin dagang.
    const modalBaru = hitungModalPerUnit(BERAT, PERSEN_MODAL, HARGA_24K_SAAT_JUAL, 0);
    expect(modalBaru - modalLama).toBe(3_097_468);
  });
});

describe("hitungModalPerUnit", () => {
  it("jatuh ke harga_beli katalog kalau harga emas hari ini tidak ada", () => {
    expect(hitungModalPerUnit(BERAT, PERSEN_MODAL, null, 5_000_000)).toBe(5_000_000);
  });

  it("jatuh ke harga_beli katalog kalau persen modal barang belum diisi", () => {
    expect(hitungModalPerUnit(BERAT, 0, HARGA_24K_SAAT_JUAL, 5_000_000)).toBe(5_000_000);
  });
});
