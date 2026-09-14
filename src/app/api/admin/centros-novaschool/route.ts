import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { centroNovaschoolInfoSchema } from "@/lib/validation";
import { registrarEventoSistema } from "@/lib/audit";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const CENTROS = ["OPENWORLD", "MEDINA_ELVIRA", "ANORETA"] as const;

// Datos fiscales/de contacto de los tres centros propios de Novaschool, para
// rellenar el PDF del presupuesto. Solo ADMIN los ve y los edita.
async function handlerGET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const filas = await prisma.centroNovaschoolInfo.findMany();
  const porCentro = new Map(filas.map((f) => [f.centro, f]));

  return NextResponse.json({
    centros: CENTROS.map((centro) => {
      const f = porCentro.get(centro);
      return {
        centro,
        razonSocial: f?.razonSocial ?? null,
        cif: f?.cif ?? null,
        oid: f?.oid ?? null,
        direccion: f?.direccion ?? null,
      };
    }),
  });
}

async function handlerPATCH(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = centroNovaschoolInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  await prisma.centroNovaschoolInfo.upsert({
    where: { centro: d.centro },
    create: {
      centro: d.centro,
      razonSocial: d.razonSocial || null,
      cif: d.cif || null,
      oid: d.oid || null,
      direccion: d.direccion || null,
    },
    update: {
      razonSocial: d.razonSocial || null,
      cif: d.cif || null,
      oid: d.oid || null,
      direccion: d.direccion || null,
    },
  });

  await registrarEventoSistema({
    actorId: user.id,
    accion: "Datos fiscales de centro Novaschool actualizados",
    detalle: d.centro,
  });

  return NextResponse.json({ ok: true });
}

export const GET = withApi("GET /api/admin/centros-novaschool", handlerGET as never);
export const PATCH = withApi("PATCH /api/admin/centros-novaschool", handlerPATCH as never);
