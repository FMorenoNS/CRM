import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { canAccessCentro, forbidden } from "@/lib/permissions";
import { construirDatosPresupuestoPdf, generarPresupuestoPdf } from "@/lib/presupuesto-pdf";

// Descarga directa del PDF del presupuesto (sin pasar por correo), para
// poder revisarlo o mandarlo a mano por otro canal.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id },
    select: { centroId: true },
  });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canAccessCentro(auth, estancia.centroId)) return forbidden();

  const url = new URL(request.url);
  const idioma = url.searchParams.get("idioma") === "es" ? "es" : "en";

  const datos = await construirDatosPresupuestoPdf(id, idioma);
  if (!datos) {
    return NextResponse.json(
      { error: "Esta estancia todavía no tiene un presupuesto calculado." },
      { status: 404 }
    );
  }

  const pdf = await generarPresupuestoPdf(datos);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="presupuesto-${datos.numero}.pdf"`,
    },
  });
}
