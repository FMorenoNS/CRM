import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CentroQuickAddRow } from "./centro-quick-add-row";
import { CANAL_OPTIONS, PAIS_OPTIONS, TIPO_CLIENTE_LABELS } from "@/lib/labels";
import { getSession } from "@/lib/session";
import { centroVisibilityFilter } from "@/lib/permissions";

const COLUMN_COUNT = 9;

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
  searchParams: Promise<{ pais?: string; nombre?: string; canal?: string }>;
}) {
  const { pais, nombre, canal } = await searchParams;

  const session = await getSession();
  if (!session) redirect("/login");
  const visibilidad = centroVisibilityFilter(session);

  const centros = await prisma.centro.findMany({
    where: {
      ...(visibilidad ?? {}),
      pais: pais || undefined,
      canalOrigen: canal || undefined,
      nombre: nombre ? { contains: nombre, mode: "insensitive" } : undefined,
    },
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
  });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
        <div className="flex gap-2">
          <a
            href="/api/export"
            className="flex-1 rounded border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 sm:flex-none"
          >
            Exportar a Excel
          </a>
          <Link
            href="/centros/nuevo"
            className="flex-1 rounded bg-brand-navy px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-navy-dark sm:flex-none"
          >
            Nuevo cliente
          </Link>
        </div>
      </div>

      {/* Los filtros se apilan en el móvil y se ponen en línea a partir de
          tablet, donde ya caben. */}
      <form className="mt-4 grid gap-3 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="nombre" className="text-gray-600">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            defaultValue={nombre ?? ""}
            placeholder="Buscar por nombre"
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          />
        </div>
        <div className="flex flex-col gap-1 sm:ml-2 sm:flex-row sm:items-center sm:gap-2">
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
          <label htmlFor="canal" className="text-gray-600">
            Canal de origen
          </label>
          <select
            id="canal"
            name="canal"
            defaultValue={canal ?? ""}
            className="w-full rounded border border-gray-300 px-2 py-2 sm:w-auto sm:py-1"
          >
            <option value="">Todos</option>
            {CANAL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
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

      {/* Móvil: una tarjeta por cliente. Una tabla de nueve columnas en una
          pantalla de 375 px obliga a arrastrar de lado para leer una fila,
          así que ahí se muestra lo que de verdad se usa. */}
      <ul className="mt-6 flex flex-col gap-3 md:hidden">
        {centros.map((centro) => {
          const contacto = centro.contactos[0];
          const estancia = centro.estancias[0];
          const grupoUrl = estancia?.interacciones[0]?.grupoUrl ?? null;
          return (
            <li
              key={centro.id}
              className="rounded border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/centros/${centro.id}`}
                  className="font-medium text-brand-navy hover:underline"
                >
                  {centro.nombre}
                </Link>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {TIPO_CLIENTE_LABELS[centro.tipo]}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600">
                {[centro.ciudad, centro.pais].filter(Boolean).join(", ")}
              </p>
              {contacto?.nombre && (
                <p className="mt-2 text-sm text-gray-700">
                  {contacto.nombre}
                  {contacto.cargo && (
                    <span className="text-gray-400"> · {contacto.cargo}</span>
                  )}
                </p>
              )}
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <div className="flex gap-1">
                  <dt>Alta:</dt>
                  <dd className="text-gray-700">
                    {formatFecha(centro.createdAt)}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt>Canal:</dt>
                  <dd className="text-gray-700">{centro.canalOrigen}</dd>
                </div>
                {estancia?.tipoPrograma && (
                  <div className="flex gap-1">
                    <dt>Programa:</dt>
                    <dd className="text-gray-700">{estancia.tipoPrograma}</dd>
                  </div>
                )}
              </dl>
              {grupoUrl && (
                <a
                  href={grupoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-brand-navy hover:underline"
                >
                  Ver grupo de Facebook
                </a>
              )}
            </li>
          );
        })}
        {centros.length === 0 && (
          <li className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
            No hay clientes registrados todavía.
          </li>
        )}
      </ul>

      {/* De tablet en adelante, la tabla completa con el alta rápida. */}
      <div className="mt-6 hidden overflow-x-auto rounded border border-gray-200 bg-white md:block">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-gray-50 text-center text-gray-500">
            <tr>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Tipo</th>
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
                <tr key={centro.id} className="border-t border-gray-100 text-center">
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
                  <td className="px-4 py-2">{TIPO_CLIENTE_LABELS[centro.tipo]}</td>
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
                  No hay clientes registrados todavía.
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
