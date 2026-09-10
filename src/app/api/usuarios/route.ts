import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { userSchema } from "@/lib/validation";
import { hashPassword, validarFortaleza } from "@/lib/passwords";
import { registrarEventoSistema } from "@/lib/audit";
import { DEMASIADO_GRANDE, getClientIp, readJsonBody } from "@/lib/request";
import { ROLE_LABELS } from "@/lib/labels";
import { withApi } from "@/lib/http";

async function handlerPOST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 413 });
  }
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  const problema = validarFortaleza(parsed.data.password, email);
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      nombre: parsed.data.nombre,
      email,
      passwordHash,
      role: parsed.data.role,
      // La contraseña la elige el administrador, así que es temporal: el
      // usuario tendrá que cambiarla la primera vez que entre. De este modo
      // nadie más que él conoce su contraseña definitiva.
      debeCambiarPassword: true,
      centros: parsed.data.centroIds?.length
        ? { connect: parsed.data.centroIds.map((id) => ({ id })) }
        : undefined,
      centroAsignado: parsed.data.centroAsignado || null,
    },
  });

  await registrarEventoSistema({
    actorId: admin.id,
    actorEmail: admin.email,
    accion: "Usuario creado",
    detalle: `${user.email} · ${ROLE_LABELS[user.role] ?? user.role}`,
    ip: getClientIp(request),
  });

  return NextResponse.json({ id: user.id });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/usuarios", handlerPOST as never);
