"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HeaderSearch } from "./header-search";

export type GrupoNav = {
  titulo: string | null;
  links: { href: string; label: string }[];
};

/**
 * Navegación para pantallas pequeñas.
 *
 * En el móvil no caben en una línea el título, los cinco destinos, el
 * buscador y el menú de usuario, así que todo lo que no es el usuario se
 * recoge aquí detrás de un botón. En pantallas grandes este componente no
 * se muestra: manda la barra de siempre.
 */
export function MobileMenu({ grupos }: { grupos: GrupoNav[] }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  // Al cambiar de página se cierra: si no, el panel se queda abierto encima
  // de la pantalla nueva.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
        className="flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-lg leading-none text-brand-navy"
      >
        {abierto ? "✕" : "☰"}
      </button>

      {abierto && (
        <>
          {/* Al tocar fuera se cierra. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setAbierto(false)}
            className="fixed inset-0 top-14 z-30 cursor-default bg-brand-navy/20"
          />
          <div className="absolute left-0 right-0 top-full z-40 border-b-2 border-brand-gold bg-white shadow-lg">
            <div className="flex flex-col gap-4 px-4 py-4">
              <HeaderSearch />
              {grupos.map((g) => (
                <div key={g.titulo ?? "principal"} className="flex flex-col">
                  {g.titulo && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {g.titulo}
                    </p>
                  )}
                  {g.links.map((link) => {
                    const activo =
                      link.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setAbierto(false)}
                        className={`rounded px-2 py-2.5 text-base ${
                          activo
                            ? "bg-brand-navy/10 font-medium text-brand-navy"
                            : "text-gray-700"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
