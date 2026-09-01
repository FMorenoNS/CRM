"use client";

import { useRouter } from "next/navigation";

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

  if (estancias.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="estancia-selector" className="text-sm text-gray-600">
        Ver estancia
      </label>
      <select
        id="estancia-selector"
        value={selectedId ?? ""}
        onChange={(e) =>
          router.push(`/centros/${centroId}?estancia=${e.target.value}`)
        }
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
