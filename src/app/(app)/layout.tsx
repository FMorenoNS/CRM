import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";

const NAV_LINKS = [
  { href: "/", label: "Panel" },
  { href: "/centros", label: "Centros" },
  { href: "/estancias", label: "Pipeline" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b-2 border-brand-gold bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-brand-navy">
              CRM Erasmus+
            </span>
            <nav className="flex gap-4 text-sm text-gray-600">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-brand-navy"
                >
                  {link.label}
                </Link>
              ))}
              {session.role === "ADMIN" && (
                <Link href="/usuarios" className="hover:text-brand-navy">
                  Usuarios
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{session.nombre}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
