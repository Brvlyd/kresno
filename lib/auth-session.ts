/** Kunci sessionStorage yang menandai user sudah login lewat halaman PIN (/login). */
export const SESSION_KEY = "kresno_login_unlocked";

export function isLoggedIn(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLoggedIn() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
}

export function clearLoggedIn() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
