import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Telaio", template: "%s · Telaio" },
  description: "Il gestionale commerciale di Mattia Capelli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${bricolage.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
