import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// La ficha de la estancia ahora vive dentro del perfil del centro (vista
// unificada). Esta ruta redirige al centro con la estancia preseleccionada.
export default async function EstanciaRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estancia = await prisma.estancia.findUnique({
    where: { id },
    select: { centroId: true },
  });

  if (!estancia) notFound();

  redirect(`/centros/${estancia.centroId}?estancia=${id}`);
}
