"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/hutang-piutang", label: "Hutang Piutang" },
  { href: "/inventori", label: "Inventori" },
  { href: "/keuangan", label: "Keuangan" },
  { href: "/pos", label: "Point of Sale" },
  { href: "/pegadaian", label: "Pegadaian" },
  { href: "/servis", label: "Servis" },
  { href: "/pembelian", label: "Pembelian" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-[250px] min-h-screen flex flex-col relative flex-shrink-0"
      style={{ backgroundColor: "#6F5333" }}
    >
      {/* Thin white divider line on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-px" style={{ backgroundColor: "#ECECEC" }} />

      {/* Logo area */}
      <div className="flex flex-col items-center pt-8 pb-6">
        <Image
          src="/logo-kresno.png"
          alt="Logo Toko Mas Kresno"
          width={160}
          height={190}
          className="object-contain"
          priority
        />
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block px-6 py-[14px] text-[17px] font-medium transition-colors"
              style={
                isActive
                  ? { backgroundColor: "#C99A36", color: "#FEFEFE" }
                  : { color: "#FEFEFE" }
              }
            >
              {item.label}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="mx-6 my-2" style={{ height: "1px", backgroundColor: "#E1E1E1" }} />

        <Link
          href="/login"
          className="block px-6 py-[14px] text-[17px] font-medium transition-colors"
          style={{ color: "#FEFEFE" }}
        >
          Logout
        </Link>
      </nav>
    </aside>
  );
}
