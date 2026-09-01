import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CentroQuickAddRow } from "./centro-quick-add-row";

const COLUMN_COUNT = 8;

function formatFecha(d: Date) {
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CentrosPage({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const { pais } = await searchParams;

  const [centros, paises] = await Promise.all([
    prisma.centro.findMany({
      where: pais ? { pais } : undefined,
      include: {
        contactos: { orderBy: { createdAt: "asc" }, take: 1 },
        estancias: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            interacciones: {
              where: { tipo: "CAPTACION_FACEBOOK" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.centro.findMany({
      distinct: ["pais"],
      select: { pais: true },
      orderBy: { pais: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Centros</h1>
        <Link
          href="/centros/nuevo"
          className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"
        >
          Nuevo centro
        </Link>
      </div>

      <form className="mt-4 flex items-center gap-2 text-sm">
        <label htmlFor="pais" className="text-gray-600">
          Filtrar por país
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
        <button
          type="submit"
          className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
        >
          Aplicar
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Centro</th>
              <th className="px-4 py-2">País</th>
              <th className="px-4 py-2">Fecha alta</th>
              <th className="px-4 py-2">Persona de contacto</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Canal de origen</th>
              <th className="px-4 py-2">Tipo de programa</th>
              <th className="px-4 py-2">Grupo de Facebook</th>
            </tr>
          </thead>
          <tbody>
            {centros.map((centro) => {
              const contacto = centro.contactos[0];
              const estancia = centro.estancias[0];
              const grupoUrl = estancia?.interacciones[0]?.grupoUrl ?? null;
              return (
                <tr key={centro.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <Link
                      href={`/centros/${centro.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {centro.nombre}
                    </Link>
                    {centro.ciudad && (
                      <span className="block text-xs text-gray-400">
                        {centro.ciudad}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{centro.pais}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatFecha(centro.createdAt)}
                  </td>
                  <td className="px-4 py-2">{contacto?.nombre ?? ""}</td>
                  <td className="px-4 py-2">{contacto?.cargo ?? ""}</td>
                  <td className="px-4 py-2">{centro.canalOrigen}</td>
                  <td className="px-4 py-2">{estancia?.tipoPrograma ?? ""}</td>
                  <td className="px-4 py-2">
                    {grupoUrl && (
                      <a
                        href={grupoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-navy hover:underline"
                      >
                        Ver grupo
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {centros.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No hay centros registrados todavía.
                </td>
              </tr>
            )}
            <CentroQuickAddRow colSpan={COLUMN_COUNT} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
