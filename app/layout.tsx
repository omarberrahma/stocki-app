import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Stocki | نظام إدارة الجرد والمخزون الذكي",
  description: "منصة الجرد الميداني المباشر وتتبع السلع بالباركود",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
