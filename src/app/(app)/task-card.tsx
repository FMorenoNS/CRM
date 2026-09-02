"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PIPELINE_ESTADOS } from "@/lib/labels";

type Contacto =
  | { nombre: string; telefono: string | null; email: string | null }
  | undefined;

function contactoLinea(contacto: Contacto) {
  if (!contacto) return "Sin contacto registrado";
  return [contacto.nombre, contacto.telefono, contacto.email]
    .filter(Boolean)
    .join(" · ");
}

const TONE_BORDER = {
  amber: "border-amber-200 hover:border-amber-400",
  rose: "border-rose-200 hover:border-rose-400",
  slate: "border-slate-200 hover:border-slate-400",
};

const TONE_TEXT = {
  amber: "text-amber-700",
  rose: "text-rose-700",
  slate: "text-slate-600",
};

// Tarjeta interactiva de una tarea del día: al pulsar el botón redondo se
// marca como completada y la estancia avanza a la siguiente fase de la
// pipeline (siguiente estado en PIPELINE_ESTADOS).
export function TaskCard({
  href,
  centroNombre,
  contacto,
  detalle,
  tone,
  estanciaId,
  estado,
}: {
  href: string;
  centroNombre: string;
  contacto: Contacto;
  detalle: string;
  tone: "amber" | "rose" | "slate";
  estanciaId: string;
  estado: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  const idx = PIPELINE_ESTADOS.indexOf(
    estado as (typeof PIPELINE_ESTADOS)[number]
  );
  const siguiente =
    idx >= 0 && idx < PIPELINE_ESTADOS.length - 1
      ? PIPELINE_ESTADOS[idx + 1]
      : null;

  async function completar(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!siguiente || isPending) return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: siguiente }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  if (done) return null;

  return (
    <div
      className={`relative rounded border bg-white px-3 py-2 text-sm ${TONE_BORDER[tone]}`}
    >
      <Link href={href} className="block pr-6">
        <span className="font-medium text-gray-900">{centroNombre}</span>
        <span className="block text-gray-600">{contactoLinea(contacto)}</span>
        <span className={`text-xs ${TONE_TEXT[tone]}`}>{detalle}</span>
      </Link>
      {siguiente && (
        <button
          type="button"
          onClick={completar}
          disabled={isPending}
          title="Marcar como completada (avanza a la siguiente fase de la pipeline)"
          aria-label="Marcar como completada"
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-400 hover:border-green-500 hover:text-green-600 disabled:opacity-50"
        >
          ✓
        </button>
      )}
    </div>
  );
}
