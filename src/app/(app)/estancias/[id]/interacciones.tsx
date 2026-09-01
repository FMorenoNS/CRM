"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { INTERACCION_LABELS } from "@/lib/labels";

export type InteraccionItem = {
  id: string;
  tipo: string;
  resumen: string;
  fecha: string; // ISO
  autorNombre: string;
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function Interacciones({
  estanciaId,
  interacciones,
}: {
  estanciaId: string;
  interacciones: InteraccionItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      tipo: (data.get("tipo") as string) ?? "NOTA",
      fecha: (data.get("fecha") as string) || undefined,
      resumen: (data.get("resumen") as string) ?? "",
    };
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/interacciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo registrar la interacción.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta interacción?")) return;
    await fetch(`/api/interacciones/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {interacciones.map((i) => (
          <li
            key={i.id}
            className="flex items-start justify-between rounded border border-gray-200 bg-white px-4 py-2 text-sm"
          >
            <div>
              <p className="text-gray-900">
                <span className="font-medium">
                  {INTERACCION_LABELS[i.tipo] ?? i.tipo}
                </span>{" "}
                <span className="text-gray-400">
                  · {formatFecha(i.fecha)} · {i.autorNombre}
                </span>
              </p>
              <p className="text-gray-600">{i.resumen}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(i.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Eliminar
            </button>
          </li>
        ))}
        {interacciones.length === 0 && (
          <p className="text-sm text-gray-500">Sin interacciones registradas.</p>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
      >
        <p className="text-sm font-medium text-gray-700">Registrar interacción</p>
        <div className="grid grid-cols-2 gap-3">
          <select
            name="tipo"
            defaultValue="LLAMADA"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="LLAMADA">Llamada</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="NOTA">Nota</option>
          </select>
          <input
            name="fecha"
            type="date"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          name="resumen"
          required
          rows={2}
          placeholder="Resumen de la conversación…"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Registrar"}
        </button>
      </form>
    </div>
  );
}
