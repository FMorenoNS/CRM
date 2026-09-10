import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Erasmus+ Novaschool",
  description: "CRM de captación Erasmus+ para la residencia Novaschool Granada",
};

// Declarado a mano en lugar de dejar el valor por defecto de Next: sin esto
// el móvil dibuja la página a 980 px y luego la reduce, así que todo sale
// diminuto. `maximumScale` no se toca: limitar el zoom perjudica a quien
// necesita ampliar para leer.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
