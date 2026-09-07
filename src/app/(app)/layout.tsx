import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UserMenu } from "./user-menu";
import { NavDropdown } from "./nav-dropdown";
import { HeaderSearch } from "./header-search";

const NAV_LINKS = [
  { href: "/", label: "Panel" },
  { href: "/centros", label: "Clientes" },
  { href: "/estancias", label: "Pipeline" },
];

const ANALISIS_LINKS = [
  { href: "/tareas", label: "Tareas" },
  { href: "/informes", label: "Informes" },
];

const ADMIN_LINKS = [
  { href: "/habitaciones", label: "Habitaciones" },
  { href: "/usuarios", label: "Usuarios" },
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
            <nav className="flex items-center gap-4 text-sm text-gray-600">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-brand-navy"
                >
                  {link.label}
                </Link>
              ))}
              <NavDropdown label="Análisis" links={ANALISIS_LINKS} />
              {session.role === "ADMIN" && (
                <NavDropdown label="Administración" links={ADMIN_LINKS} />
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <HeaderSearch />
            <UserMenu nombre={session.nombre} role={session.role} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
