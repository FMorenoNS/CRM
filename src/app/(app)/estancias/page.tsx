import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Kanban, type EstanciaCard } from "./kanban";

export default async function EstanciasPage({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string; participante?: string }>;
}) {
  const { pais, participante } = await searchParams;

  const estancias = await prisma.estancia.findMany({
    where: {
      centro: pais ? { pais } : undefined,
      tipoParticipante:
        participante === "ALUMNOS" || participante === "PROFESORES"
          ? participante
          : undefined,
    },
    include: { centro: { select: { id: true, nombre: true, pais: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const paises = await prisma.centro.findMany({
    distinct: ["pais"],
    select: { pais: true },
    orderBy: { pais: "asc" },
  });

  const cards: EstanciaCard[] = estancias.map((e) => ({
    id: e.id,
    centroId: e.centro.id,
    centroNombre: e.centro.nombre,
    centroPais: e.centro.pais,
    tipoPrograma: e.tipoPrograma,
    tipoParticipante: e.tipoParticipante,
    edadGrupo: e.edadGrupo,
    estado: e.estado,
    activo: e.activo,
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

      <form className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="pais" className="text-gray-600">
          País
        </label>
        <select
          id="pais"
          name="pais"
          defaultValue={pais ?? ""}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value="">Todos</option>
          {paises.map((p) => (
            <option key={p.pais} value={p.pais}>
              {p.pais}
            </option>
          ))}
        </select>
        <label htmlFor="participante" className="ml-2 text-gray-600">
          Participante
        </label>
        <select
          id="participante"
          name="participante"
          defaultValue={participante ?? ""}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value="">Todos</option>
          <option value="ALUMNOS">Alumnos</option>
          <option value="PROFESORES">Profesores</option>
        </select>
        <button
          type="submit"
          className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
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
