"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type EstanciaOption = {
  id: string;
  label: string;
};

export function EstanciaSelector({
  centroId,
  estancias,
  selectedId,
}: {
  centroId: string;
  estancias: EstanciaOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (estancias.length === 0) return null;

  function cambiar(nuevaEstanciaId: string) {
    // Conserva el resto de parámetros (p. ej. `tab`, para no volver siempre
    // a "Resumen" al cambiar de estancia).
    const params = new URLSearchParams(searchParams.toString());
    params.set("estancia", nuevaEstanciaId);
    router.push(`/centros/${centroId}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="estancia-selector" className="text-sm text-gray-600">
        Ver estancia
      </label>
      <select
        id="estancia-selector"
        value={selectedId ?? ""}
        onChange={(e) => cambiar(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        {estancias.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
