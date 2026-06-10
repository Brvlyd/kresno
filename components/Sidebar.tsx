"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/inventori", label: "Inventori", icon: "📦" },
  { href: "/keuangan", label: "Keuangan", icon: "💰" },
  { href: "/pos", label: "Point of Sale", icon: "🛒" },
  { href: "/pegadaian", label: "Pegadaian", icon: "💎" },
  { href: "/servis", label: "Servis", icon: "🔧" },
  { href: "/pembelian", label: "Pembelian", icon: "🛍️" },
  { href: "/hutang-piutang", label: "Hutang & Piutang", icon: "📋" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 min-h-screen flex flex-col shadow-xl"
      style={{ backgroundColor: "#6F5333" }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo-kresno.png"
            alt="Logo Kresno"
            width={48}
            height={56}
            className="object-contain flex-shrink-0"
          />
          <div>
            <p className="text-amber-100 text-xs font-medium tracking-widest uppercase">
              Toko Mas
            </p>
            <p
              className="text-white font-extrabold text-xl leading-tight tracking-wide"
              style={{ fontFamily: "serif" }}
            >
              KRESNO
            </p>
            <p className="text-amber-200 text-xs">SITOMAS</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium transition-all duration-200"
              style={
                isActive
                  ? { backgroundColor: "#FFFBE9", color: "#6F5333" }
                  : { color: "#F5E6C8" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "rgba(255,255,255,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "transparent";
                }
              }}
            >
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div
        className="px-3 py-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
      >
        <Link
          href="/login"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 w-full"
        >
          <span className="text-xl w-7 text-center">🚪</span>
          <span>Keluar</span>
        </Link>
      </div>
    </aside>
  );
}
