import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EstanciaForm } from "../estancia-form";

export default async function NuevaEstanciaPage({
  searchParams,
}: {
  searchParams: Promise<{ centroId?: string }>;
}) {
  const { centroId } = await searchParams;
  const centros = await prisma.centro.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (centros.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Nueva estancia</h1>
        <p className="mt-4 text-sm text-gray-600">
          Primero necesitas crear un{" "}
          <Link href="/centros/nuevo" className="text-brand-navy hover:underline">
            centro de origen
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Nueva estancia</h1>
      <div className="mt-6">
        <EstanciaForm
          mode="create"
          centros={centros}
          defaultValues={{ centroId }}
        />
      </div>
    </div>
  );
}
