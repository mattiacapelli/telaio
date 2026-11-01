import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AggiornamentoPwa } from "@/components/pwa/aggiornamento-pwa";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Telaio", template: "%s · Telaio" },
  description: "Il gestionale commerciale di Mattia Capelli",
  applicationName: "Telaio",
  // Il manifest è collegato in automatico da app/manifest.ts.
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS: a schermo intero quando aggiunta alla schermata Home.
  appleWebApp: { capable: true, title: "Telaio", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191a1c" },
  ],
  // Usa tutta l'area dello schermo (notch compreso): i margini sicuri si gestiscono con env(safe-area-inset-*).
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <AggiornamentoPwa />
      </body>
    </html>
  );
}
