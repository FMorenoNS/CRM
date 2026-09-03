import type { NextConfig } from "next";

// Cabeceras de seguridad que no dependen de cada petición (las que sí
// dependen —la Content-Security-Policy, que lleva un "nonce" distinto en
// cada carga— se añaden en src/middleware.ts).
const securityHeaders = [
  // Obliga al navegador a usar siempre HTTPS con este dominio durante 2 años,
  // incluidos los subdominios. Solo tiene efecto si ya se sirve por HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Impide que el navegador "adivine" el tipo de un archivo (evita que un
  // fichero de texto se acabe ejecutando como script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nadie puede meter el CRM dentro de un iframe en otra web (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // No filtrar la URL interna del CRM al navegar a webs externas.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El CRM no necesita cámara, micrófono ni geolocalización: se deniegan.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Aísla la pestaña del CRM de otras ventanas que pudieran abrirla.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Evita que otras webs incrusten recursos del CRM.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Las respuestas con datos nunca deben quedar en cachés intermedias.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // Salida standalone: genera un servidor autónomo en .next/standalone,
  // ideal para desplegar en Docker con una imagen ligera.
  output: "standalone",

  // No anunciar que el servidor es Next.js (cabecera x-powered-by).
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
