import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Erasmus+ Novaschool",
  description: "CRM de captación Erasmus+ para la residencia Novaschool Granada",
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
