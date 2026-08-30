import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Twenty usa Inter (FONT_COMMON.family) con pesi 400/500/600.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Telaio · Studio Ferrero",
  description:
    "Gestionale per studio: clienti, preventivi, progetti, ore, fatture e incassi.",
};

/**
 * Il layout radice non contiene la chrome dell'app: il login deve poter
 * occupare la pagina intera. Sidebar e topbar stanno nel gruppo (app).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-theme="dark" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
