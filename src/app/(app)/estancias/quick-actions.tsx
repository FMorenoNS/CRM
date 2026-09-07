"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SidePanel } from "@/app/(app)/side-panel";

type Resumen = {
  centroId: string;
  centroNombre: string;
  estadoLabel: string;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
};

function contactoLinea(r: Resumen): string {
  return [r.contactoNombre, r.contactoTelefono, r.contactoEmail].filter(Boolean).join(" · ") || "Sin contacto registrado";
}

export function EstanciaQuickActions({ estanciaId }: { estanciaId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();
  const [enviado, setEnviado] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    setEnviado(false);
    setError(undefined);
    fetch(`/api/estancias/${estanciaId}/resumen`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setResumen)
      .catch(() => setError("No se pudo cargar el resumen."))
      .finally(() => setCargando(false));
  }, [open, estanciaId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/interacciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: (data.get("tipo") as string) ?? "NOTA",
          resumen: (data.get("resumen") as string) ?? "",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo registrar la interacción.");
        return;
      }
      form.reset();
      setEnviado(true);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-gray-500 hover:text-brand-navy hover:underline"
      >
        Acciones rápidas
      </button>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Acciones rápidas">
        {cargando && <p className="text-sm text-gray-500">Cargando…</p>}
        {!cargando && resumen && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{resumen.centroNombre}</p>
              <p className="text-sm text-gray-600">{contactoLinea(resumen)}</p>
              <p className="mt-1 inline-block rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-medium text-brand-navy">
                {resumen.estadoLabel}
              </p>
            </div>
            <a
              href={`/centros/${resumen.centroId}?estancia=${estanciaId}`}
              className="text-sm text-brand-navy hover:underline"
            >
              Ver ficha completa →
            </a>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">Registrar interacción</p>
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
              <textarea
                name="resumen"
                required
                rows={3}
                placeholder="Resumen de la conversación…"
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {enviado && (
                <p className="text-sm text-green-700">Interacción registrada.</p>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Registrar"}
              </button>
            </form>
          </div>
        )}
        {!cargando && !resumen && error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </SidePanel>
    </>
  );
}
