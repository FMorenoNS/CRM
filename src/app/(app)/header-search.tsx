"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Resultado = { id: string; nombre: string; pais: string };

export function HeaderSearch() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onChange(value: string) {
    setQ(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (value.trim().length < 2) {
      setResultados([]);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/centros/buscar?q=${encodeURIComponent(value.trim())}`);
      if (!res.ok) return;
      const data: Resultado[] = await res.json();
      setResultados(data);
      setOpen(true);
    }, 300);
  }

  return (
    <div ref={ref} className="relative w-56">
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onFocus={() => resultados.length > 0 && setOpen(true)}
        placeholder="Buscar cliente…"
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
      />
      {open && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {resultados.map((c) => (
            <Link
              key={c.id}
              href={`/centros/${c.id}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-gray-700 hover:bg-gray-50 hover:text-brand-navy"
            >
              <span className="font-medium">{c.nombre}</span>{" "}
              <span className="text-xs text-gray-400">{c.pais}</span>
            </Link>
          ))}
          {resultados.length === 0 && (
            <p className="px-3 py-1.5 text-gray-500">Sin resultados.</p>
          )}
        </div>
      )}
    </div>
  );
}
