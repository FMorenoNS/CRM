import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessCentro } from "@/lib/permissions";

// La ficha de la estancia ahora vive dentro del perfil del centro (vista
// unificada). Esta ruta redirige al centro con la estancia preseleccionada.
export default async function EstanciaRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const estancia = await prisma.estancia.findUnique({
    where: { id },
    select: { centroId: true },
  });

  if (!estancia) notFound();

  // Comprobación de permisos ANTES de redirigir. Sin esto, alguien de
  // Dirección podía ir probando identificadores en la URL y, aunque no
  // llegara a ver los datos, la redirección le confirmaba qué estancias
  // existen y a qué cliente pertenecen.
  //
  // Se responde "no encontrado" en vez de "no tienes permiso": así no se
  // revela si la estancia existe o no.
  if (!canAccessCentro(session, estancia.centroId)) notFound();

  redirect(`/centros/${estancia.centroId}?estancia=${id}`);
}
