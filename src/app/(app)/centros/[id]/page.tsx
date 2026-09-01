import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CentroEditForm } from "../centro-form";
import { ContactoForm } from "./contacto-form";
import { DeleteContactoButton, DeleteCentroButton } from "./delete-buttons";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { EstanciaSelector, type EstanciaOption } from "./estancia-selector";
import { EstanciaPanel } from "./estancia-panel";

function estanciaLabel(e: {
  tipoParticipante: string;
  edadGrupo: string | null;
  tipoPrograma: string;
  fechaInicio: Date | null;
  createdAt: Date;
  activo: boolean;
}): string {
  const fecha = (e.fechaInicio ?? e.createdAt).toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });
  const partes = [
    fecha,
    PARTICIPANTE_LABELS[e.tipoParticipante],
    e.edadGrupo,
    e.tipoPrograma,
  ].filter(Boolean);
  return partes.join(" · ") + (e.activo ? "" : " (inactiva)");
}

export default async function CentroDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estancia?: string }>;
}) {
  const { id } = await params;
  const { estancia: estanciaParam } = await searchParams;

  const centro = await prisma.centro.findUnique({
    where: { id },
    include: {
      contactos: { orderBy: { createdAt: "asc" } },
      estancias: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!centro) notFound();

  // Estancia seleccionada: la del parámetro si es válida; si no, la más reciente.
  const selectedId =
    estanciaParam && centro.estancias.some((e) => e.id === estanciaParam)
      ? estanciaParam
      : (centro.estancias[0]?.id ?? null);

  const opciones: EstanciaOption[] = centro.estancias.map((e) => ({
    id: e.id,
    label: estanciaLabel(e),
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {centro.nombre}
          </h1>
          <p className="text-sm text-gray-500">
            {[centro.ciudad, centro.pais].filter(Boolean).join(", ")}
          </p>
        </div>
        <DeleteCentroButton centroId={centro.id} />
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium text-gray-900">Datos del centro</h2>
          <div className="mt-4">
            <CentroEditForm
              centroId={centro.id}
              defaultValues={{
                nombre: centro.nombre,
                pais: centro.pais,
                ciudad: centro.ciudad,
                canalOrigen: centro.canalOrigen,
                notas: centro.notas,
              }}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-gray-900">Contactos</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {centro.contactos.map((contacto) => (
              <li
                key={contacto.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{contacto.nombre}</p>
                  <p className="text-gray-500">
                    {[contacto.cargo, contacto.telefono, contacto.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <DeleteContactoButton contactoId={contacto.id} />
              </li>
            ))}
            {centro.contactos.length === 0 && (
              <p className="text-sm text-gray-500">Sin contactos todavía.</p>
            )}
          </ul>
          <div className="mt-4">
            <ContactoForm centroId={centro.id} />
          </div>
        </section>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-gray-900">Estancias</h2>
            <EstanciaSelector
              centroId={centro.id}
              estancias={opciones}
              selectedId={selectedId}
            />
          </div>
          <Link
            href={`/estancias/nueva?centroId=${centro.id}`}
            className="rounded bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-dark"
          >
            Nueva estancia
          </Link>
        </div>

        <div className="mt-4">
          {selectedId ? (
            <EstanciaPanel estanciaId={selectedId} />
          ) : (
            <p className="text-sm text-gray-500">
              Este centro no tiene estancias todavía. Crea la primera con
              “Nueva estancia”.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
