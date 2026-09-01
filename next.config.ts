import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida standalone: genera un servidor autónomo en .next/standalone,
  // ideal para desplegar en Docker con una imagen ligera.
  output: "standalone",
};

export default nextConfig;
