"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
  {
    href: "/dashboard", label: "Dashboard",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M3 11.5L12 4l9 7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: "/inventori", label: "Inventori",
    icon: <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6"><path d="M16 3L29 10v12L16 29 3 22V10L16 3z" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M3 10l13 7M16 29V17M29 10l-13 7" stroke="currentColor" strokeWidth="2"/></svg>,
  },
  {
    href: "/pembelian", label: "Pembelian",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M6 6h15l-1.5 9h-12L6 6z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/><path d="M6 6L5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor"/></svg>,
  },
  {
    href: "/hutang-piutang", label: "Hutang Piutang",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h10M7 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  },
  {
    href: "/keuangan", label: "Keuangan",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M3 20V10M9 20V4M15 20v-7M21 20V8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
  {
    href: "/pos", label: "Kasir / Penjualan",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M3 6h18l-1.5 9h-15L3 6z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/><circle cx="9" cy="20" r="1.3" fill="currentColor"/><circle cx="17" cy="20" r="1.3" fill="currentColor"/><path d="M3 6L2 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  },
  {
    href: "/pegadaian", label: "Pegadaian",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><rect x="3" y="10" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M7 10V7a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>,
  },
  {
    href: "/servis", label: "Servis",
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLinks = () => (
    <>
      {menuItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-5 py-3.5 text-base font-semibold transition-colors duration-150"
            style={isActive
              ? { backgroundColor: "#C99A36", color: "#fff" }
              : { color: "#fff" }
            }
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {/* ── DESKTOP: fixed sidebar ── */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-[210px] xl:w-[230px] z-40 overflow-y-auto print:hidden"
        style={{ backgroundColor: "#6F5333" }}
      >
        {/* Logo */}
        <div className="flex justify-center items-center pt-5 pb-3 px-3 flex-shrink-0">
          <Image
            src="/logo-kresno.png"
            alt="Logo Toko Mas Kresno"
            width={110}
            height={128}
            className="object-contain"
            priority
          />
        </div>

        <div className="h-px flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />

        {/* Nav */}
        <nav className="flex-1 py-2">
          <NavLinks />
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 pb-4">
          <div className="h-px mb-1" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
          <Link
            href="/login"
            className="block px-5 py-3 text-[15px] font-semibold text-white/90 hover:text-white transition-colors"
          >
            Logout
          </Link>
        </div>
      </aside>

      {/* ── DESKTOP: spacer so content isn't hidden behind fixed sidebar ── */}
      <div className="hidden lg:block w-[210px] xl:w-[230px] flex-shrink-0 print:hidden" />

      {/* ── MOBILE: top bar ── */}
      <div
        className="lg:hidden print:hidden flex items-center justify-between px-4 py-3 fixed top-0 left-0 right-0 z-50 shadow-md"
        style={{ backgroundColor: "#6F5333" }}
      >
        <Image src="/logo-kresno.png" alt="Logo" width={42} height={48} className="object-contain" />
        <span className="text-white font-bold text-base tracking-wide">SITOMAS</span>
        <button
          className="text-white p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* ── MOBILE: spacer ── */}
      <div className="lg:hidden print:hidden h-[58px]" />

      {/* ── MOBILE: slide-down menu ── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden print:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="lg:hidden print:hidden fixed top-[58px] left-0 right-0 z-50 shadow-lg"
            style={{ backgroundColor: "#6F5333" }}
          >
            <nav className="py-2">
              <NavLinks />
            </nav>
            <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            <Link
              href="/login"
              className="block px-5 py-3 text-[15px] font-semibold text-white/90"
              onClick={() => setMobileOpen(false)}
            >
              Logout
            </Link>
          </div>
        </>
      )}
    </>
  );
}
