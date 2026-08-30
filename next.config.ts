import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necessario per l'immagine Docker: produce .next/standalone con un server
  // autonomo e le sole dipendenze effettivamente usate.
  output: "standalone",
};

export default nextConfig;
