import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UserMenu } from "./user-menu";
import { NavDropdown } from "./nav-dropdown";
import { HeaderSearch } from "./header-search";
import { MobileMenu, type GrupoNav } from "./mobile-menu";

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
  // Contraseña temporal puesta por un administrador: no se puede usar el CRM
  // hasta elegir una propia.
  if (session.debeCambiarPassword) redirect("/cambiar-password");

  // Los mismos destinos que la barra de arriba, agrupados para el menú del
  // móvil (donde no hay sitio para desplegables dentro de desplegables).
  const gruposMovil: GrupoNav[] = [
    { titulo: null, links: NAV_LINKS },
    { titulo: "Análisis", links: ANALISIS_LINKS },
    ...(session.role === "ADMIN"
      ? [{ titulo: "Administración", links: ADMIN_LINKS }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* `relative` para que el panel del menú del móvil se cuelgue de la
          cabecera y no del primer antepasado posicionado que haya. */}
      <header className="relative border-b-2 border-brand-gold bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <span className="shrink-0 font-semibold text-brand-navy">
              CRM Erasmus+
            </span>
            <nav className="hidden items-center gap-4 text-sm text-gray-600 md:flex">
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
          <div className="flex shrink-0 items-center gap-3 text-sm text-gray-600">
            <div className="hidden md:block">
              <HeaderSearch />
            </div>
            <UserMenu nombre={session.nombre} role={session.role} />
            <MobileMenu grupos={gruposMovil} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
