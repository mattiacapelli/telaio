import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Telaio", template: "%s · Telaio" },
  description: "Il gestionale commerciale di Mattia Capelli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
