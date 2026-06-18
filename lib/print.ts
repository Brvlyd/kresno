/**
 * Cetak halaman tanpa header/footer browser (judul tab) menabrak konten.
 * Title dikosongkan dulu dengan sedikit delay sebelum window.print() dipanggil,
 * karena mengubah document.title tepat di event "beforeprint" sering kalah cepat
 * dengan snapshot judul yang sudah diambil browser untuk header cetak.
 */
export function printClean(delayMs = 60) {
  const originalTitle = document.title;
  document.title = "";

  setTimeout(() => {
    window.print();

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
  }, delayMs);
}
