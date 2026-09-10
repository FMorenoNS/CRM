"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoutButton, LogoutAllButton } from "./logout-button";
import { ROLE_LABELS } from "@/lib/labels";

export function UserMenu({
  nombre,
  role,
}: {
  nombre: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white hover:bg-brand-navy-dark"
      >
        {iniciales || "?"}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 rounded border border-gray-200 bg-white py-2 text-sm shadow-lg">
          <p className="px-3 py-1 font-medium text-gray-900">{nombre}</p>
          <p className="px-3 pb-2 text-xs text-gray-500">
            {ROLE_LABELS[role] ?? role}
          </p>
          <div className="border-t border-gray-100 pt-2">
            <Link
              href="/cambiar-password"
              className="block px-3 py-1 text-gray-600 hover:bg-gray-50 hover:text-brand-navy"
              onClick={() => setOpen(false)}
            >
              Cambiar contraseña
            </Link>
          </div>
          <div className="border-t border-gray-100 px-3 pt-2">
            <LogoutButton />
          </div>
          <div className="px-3 pt-1">
            <LogoutAllButton />
          </div>
        </div>
      )}
    </div>
  );
}
