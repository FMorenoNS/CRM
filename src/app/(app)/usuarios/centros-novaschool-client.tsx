"use client";

import { useState, type FormEvent } from "react";
import { CENTRO_ASIGNADO_LABELS } from "@/lib/labels";

export type CentroNovaschoolInfoRow = {
  centro: string;
  razonSocial: string | null;
  cif: string | null;
  oid: string | null;
  direccion: string | null;
};

const inputCls = "rounded border border-gray-300 px-2 py-1.5 text-sm";

function Fila({ fila }: { fila: CentroNovaschoolInfoRow }) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    setIsPending(true);
    const d = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/admin/centros-novaschool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centro: fila.centro,
          razonSocial: (d.get("razonSocial") as string) ?? "",
          cif: (d.get("cif") as string) ?? "",
          oid: (d.get("oid") as string) ?? "",
          direccion: (d.get("direccion") as string) ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-gray-900">
        {CENTRO_ASIGNADO_LABELS[fila.centro] ?? fila.centro}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="razonSocial"
          placeholder="Razón social"
          defaultValue={fila.razonSocial ?? ""}
          className={inputCls}
        />
        <input name="cif" placeholder="CIF" defaultValue={fila.cif ?? ""} className={inputCls} />
        <input name="oid" placeholder="OID" defaultValue={fila.oid ?? ""} className={inputCls} />
        <input
          name="direccion"
          placeholder="Dirección"
          defaultValue={fila.direccion ?? ""}
          className={inputCls}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-600">Guardado.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}

export function CentrosNovaschoolClient({ filas }: { filas: CentroNovaschoolInfoRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {filas.map((f) => (
        <Fila key={f.centro} fila={f} />
      ))}
    </div>
  );
}
