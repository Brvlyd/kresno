import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import BarcodeScannerListener from "@/components/BarcodeScannerListener";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "SITOMAS - Sistem Toko Mas",
  description: "Sistem Manajemen Toko Emas Kresno",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${lato.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50" style={{ fontFamily: "var(--font-lato), sans-serif" }}>
        <BarcodeScannerListener />
        {children}
      </body>
    </html>
  );
}
