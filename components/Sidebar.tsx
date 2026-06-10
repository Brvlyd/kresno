"use client";

import Link from "next/link";
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
    <aside className="w-64 bg-[#1C1C2E] min-h-screen flex flex-col shadow-xl">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#B8860B] rounded-lg flex items-center justify-center text-white font-bold text-lg">
            💍
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">SITOMAS</h1>
            <p className="text-gray-400 text-sm">Sistem Toko Mas</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#B8860B] text-white shadow-lg"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link
          href="/login"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 w-full"
        >
          <span className="text-xl w-7 text-center">🚪</span>
          <span>Keluar</span>
        </Link>
      </div>
    </aside>
  );
}
