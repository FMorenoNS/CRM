import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Kanban, type EstanciaCard } from "./kanban";
import {
  PAIS_OPTIONS,
  PROGRAMA_OPTIONS,
  TODOS_ESTADOS,
  ESTADO_LABELS,
  DURACION_LABELS,
} from "@/lib/labels";
import { getSession } from "@/lib/session";
import { canDoOperational, centroVisibilityFilter } from "@/lib/permissions";

export default async function EstanciasPage({
  searchParams,
}: {
  searchParams: Promise<{
    pais?: string;
    participante?: string;
    tipoPrograma?: string;
    duracion?: string;
    estado?: string;
  }>;
}) {
  const { pais, participante, tipoPrograma, duracion, estado } = await searchParams;

  const session = await getSession();
  if (!session) redirect("/login");
  const visibilidad = centroVisibilityFilter(session);

  const estancias = await prisma.estancia.findMany({
    where: {
      centro: { pais: pais || undefined, ...(visibilidad ?? {}) },
      tipoParticipante:
        participante === "ALUMNOS" || participante === "PROFESORES"
          ? participante
          : undefined,
      tipoPrograma: tipoPrograma || undefined,
      duracion:
        duracion === "CORTA" || duracion === "LARGA" ? duracion : undefined,
      estado: (TODOS_ESTADOS as readonly string[]).includes(estado ?? "")
        ? (estado as (typeof TODOS_ESTADOS)[number])
        : undefined,
    },
    include: { centro: { select: { id: true, nombre: true, pais: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const cards: EstanciaCard[] = estancias.map((e) => ({
    id: e.id,
    centroId: e.centro.id,
    centroNombre: e.centro.nombre,
    centroPais: e.centro.pais,
    tipoPrograma: e.tipoPrograma,
    tipoParticipante: e.tipoParticipante,
    edadGrupo: e.edadGrupo,
    duracion: e.duracion,
    estado: e.estado,
    activo: e.activo,
    puedeEditar: canDoOperational(session, e.centro.id),
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Estancias</h1>
        <Link
          href="/estancias/nueva"
          className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"
        >
          Nueva estancia
        </Link>
      </div>

      {/* En el móvil los cuatro filtros se apilan a lo ancho de la pantalla;
          desde tablet vuelven a la línea de siempre. */}
      <form className="mt-4 grid gap-3 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="pais" className="text-gray-600">
            País
          </label>
          <select
            id="pais"
            name="pais"
            defaultValue={pais ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todos</option>
            {PAIS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:ml-2 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="participante" className="text-gray-600">
            Participante
          </label>
          <select
            id="participante"
            name="participante"
            defaultValue={participante ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todos</option>
            <option value="ALUMNOS">Alumnos</option>
            <option value="PROFESORES">Profesores</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:ml-2 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="tipoPrograma" className="text-gray-600">
            Tipo de programa
          </label>
          <select
            id="tipoPrograma"
            name="tipoPrograma"
            defaultValue={tipoPrograma ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todos</option>
            {PROGRAMA_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:ml-2 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="duracion" className="text-gray-600">
            Duración
          </label>
          <select
            id="duracion"
            name="duracion"
            defaultValue={duracion ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todas</option>
            <option value="CORTA">{DURACION_LABELS.CORTA}</option>
            <option value="LARGA">{DURACION_LABELS.LARGA}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:ml-2 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="estado" className="text-gray-600">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todos</option>
            {TODOS_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-100 sm:py-1"
        >
          Aplicar
        </button>
      </form>

      {cards.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No hay estancias todavía.
        </p>
      ) : (
        <Kanban estancias={cards} />
      )}
    </div>
  );
}
