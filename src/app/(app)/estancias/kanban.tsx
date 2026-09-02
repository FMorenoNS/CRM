"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PIPELINE_ESTADOS, ESTADO_LABELS } from "@/lib/labels";

export type EstanciaCard = {
  id: string;
  centroId: string;
  centroNombre: string;
  centroPais: string;
  tipoPrograma: string;
  tipoParticipante: "ALUMNOS" | "PROFESORES";
  edadGrupo: string | null;
  estado: string;
  activo: boolean;
  puedeEditar: boolean;
};

const COLUMNS = [...PIPELINE_ESTADOS, "PERDIDO"] as const;

function Card({
  estancia,
  onDragStart,
  onToggleActivo,
}: {
  estancia: EstanciaCard;
  onDragStart: (id: string) => void;
  onToggleActivo: (id: string) => void;
}) {
  const activa = estancia.activo;
  return (
    <div
      draggable={estancia.puedeEditar}
      onDragStart={() => estancia.puedeEditar && onDragStart(estancia.id)}
      className={`rounded border p-3 text-sm shadow-sm ${
        estancia.puedeEditar ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        activa
          ? "border-gray-200 bg-white"
          : "border-gray-200 bg-gray-100 opacity-70"
      }`}
    >
      <Link
        href={`/centros/${estancia.centroId}?estancia=${estancia.id}`}
        className={`font-medium hover:underline ${
          activa ? "text-brand-navy" : "text-gray-500"
        }`}
        draggable={false}
      >
        {estancia.centroNombre}
      </Link>
      <p className="text-xs text-gray-500">{estancia.centroPais}</p>
      <p className={`mt-1 ${activa ? "text-gray-700" : "text-gray-500"}`}>
        {estancia.tipoParticipante === "ALUMNOS" ? "Alumnos" : "Profesores"}
        {estancia.edadGrupo ? ` · ${estancia.edadGrupo}` : ""}
      </p>
      <p className="text-xs text-gray-500">{estancia.tipoPrograma}</p>
      {estancia.puedeEditar && (
        <button
          type="button"
          onClick={() => onToggleActivo(estancia.id)}
          className="mt-2 text-xs text-gray-500 hover:text-gray-800 hover:underline"
        >
          {activa ? "Marcar inactiva" : "Marcar activa"}
        </button>
      )}
    </div>
  );
}

export function Kanban({ estancias }: { estancias: EstanciaCard[] }) {
  const router = useRouter();
  const [items, setItems] = useState(estancias);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  useEffect(() => {
    setItems(estancias);
  }, [estancias]);

  async function moveTo(estado: string) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;

    const actual = items.find((e) => e.id === id);
    if (!actual || actual.estado === estado) return;

    const previo = actual.estado;
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, estado } : e)));

    try {
      const res = await fetch(`/api/estancias/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setItems((prev) =>
        prev.map((e) => (e.id === id ? { ...e, estado: previo } : e))
      );
    }
  }

  async function toggleActivo(id: string) {
    const actual = items.find((e) => e.id === id);
    if (!actual) return;
    const nuevo = !actual.activo;
    setItems((prev) =>
      prev.map((e) => (e.id === id ? { ...e, activo: nuevo } : e))
    );
    try {
      const res = await fetch(`/api/estancias/${id}/activo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: nuevo }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setItems((prev) =>
        prev.map((e) => (e.id === id ? { ...e, activo: actual.activo } : e))
      );
    }
  }

  return (
    <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colItems = items.filter((e) => e.estado === col);
        // Activas arriba; inactivas abajo (en gris, ya estilizadas en Card).
        const activas = colItems.filter((e) => e.activo);
        const inactivas = colItems.filter((e) => !e.activo);
        const isOver = overCol === col;
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== col) setOverCol(col);
            }}
            onDragLeave={() => {
              if (overCol === col) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              moveTo(col);
            }}
            className={`w-64 flex-shrink-0 rounded-lg p-2 transition-colors ${
              isOver ? "bg-brand-navy/5 ring-2 ring-brand-navy/40" : "bg-gray-100/60"
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-gray-700">
                {ESTADO_LABELS[col]}
              </h3>
              <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600">
                {colItems.length}
              </span>
            </div>
            <div className="flex min-h-[2rem] flex-col gap-2">
              {activas.map((e) => (
                <Card
                  key={e.id}
                  estancia={e}
                  onDragStart={setDragId}
                  onToggleActivo={toggleActivo}
                />
              ))}
              {inactivas.length > 0 && (
                <div className="mt-2 border-t border-gray-300 pt-2">
                  <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Inactivas
                  </p>
                  <div className="flex flex-col gap-2">
                    {inactivas.map((e) => (
                      <Card
                        key={e.id}
                        estancia={e}
                        onDragStart={setDragId}
                        onToggleActivo={toggleActivo}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
