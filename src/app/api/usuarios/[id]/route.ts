import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { deleteAllSessionsForUser } from "@/lib/session";
import {
  hashPassword,
  validarFortaleza,
  PASSWORD_MAX_LENGTH,
} from "@/lib/passwords";
import { registrarEventoSistema } from "@/lib/audit";
import { DEMASIADO_GRANDE, getClientIp, readJsonBody } from "@/lib/request";
import { ROLE_LABELS } from "@/lib/labels";
import { withApi } from "@/lib/http";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "MARKETING", "DIRECCION"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
  centroIds: z.array(z.string().max(64)).max(500).optional(),
  centroAsignado: z
    .enum(["OPENWORLD", "MEDINA_ELVIRA"])
    .optional()
    .nullable()
    .or(z.literal("")),
});

async function handlerPATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const admin = auth;
  const { id } = await params;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 413 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const objetivo = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, activo: true },
  });
  if (!objetivo) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  const quitaAdmin =
    parsed.data.role !== undefined && parsed.data.role !== "ADMIN";
  const desactiva = parsed.data.activo === false;

  // Red de seguridad 1: un administrador no puede quitarse a sí mismo el
  // rol ni desactivarse. Si no, un despiste deja el CRM sin nadie que pueda
  // gestionarlo (y habría que arreglarlo a mano en la base de datos).
  if (objetivo.id === admin.id && (quitaAdmin || desactiva)) {
    return NextResponse.json(
      {
        error:
          "No puedes quitarte a ti mismo el rol de administrador ni desactivar tu propia cuenta.",
      },
      { status: 400 }
    );
  }

  // Red de seguridad 2: nunca dejar el CRM sin ningún administrador activo.
  if (objetivo.role === "ADMIN" && (quitaAdmin || desactiva)) {
    const adminsActivos = await prisma.user.count({
      where: { role: "ADMIN", activo: true },
    });
    if (adminsActivos <= 1) {
      return NextResponse.json(
        {
          error:
            "Debe quedar al menos un administrador activo. Nombra a otro antes de hacer este cambio.",
        },
        { status: 400 }
      );
    }
  }

  const data: {
    role?: "ADMIN" | "MARKETING" | "DIRECCION";
    activo?: boolean;
    passwordHash?: string;
    debeCambiarPassword?: boolean;
    passwordUpdatedAt?: Date;
    centros?: { set: { id: string }[] };
    centroAsignado?: "OPENWORLD" | "MEDINA_ELVIRA" | null;
  } = {};
  const cambios: string[] = [];

  if (parsed.data.role) {
    data.role = parsed.data.role;
    cambios.push(`rol → ${ROLE_LABELS[parsed.data.role] ?? parsed.data.role}`);
  }
  if (parsed.data.activo !== undefined) {
    data.activo = parsed.data.activo;
    cambios.push(parsed.data.activo ? "cuenta activada" : "cuenta desactivada");
  }
  if (parsed.data.password) {
    const problema = validarFortaleza(parsed.data.password, objetivo.email);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });
    data.passwordHash = await hashPassword(parsed.data.password);
    // Contraseña puesta por un administrador = temporal: el usuario tendrá
    // que elegir la suya al entrar.
    data.debeCambiarPassword = true;
    data.passwordUpdatedAt = new Date();
    cambios.push("contraseña temporal asignada");
  }
  if (parsed.data.centroIds) {
    data.centros = { set: parsed.data.centroIds.map((cid) => ({ id: cid })) };
    cambios.push(`clientes asignados: ${parsed.data.centroIds.length}`);
  }
  if (parsed.data.centroAsignado !== undefined) {
    data.centroAsignado = parsed.data.centroAsignado || null;
    cambios.push(`centro Novaschool → ${parsed.data.centroAsignado || "ninguno"}`);
  }

  if (cambios.length === 0) {
    return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });

  // Cambio de contraseña, de rol o desactivación: se cierran todas las
  // sesiones abiertas de esa persona, para que el cambio tenga efecto
  // inmediato en todos sus dispositivos.
  if (data.passwordHash || data.activo === false || data.role) {
    await deleteAllSessionsForUser(id);
  }

  await registrarEventoSistema({
    actorId: admin.id,
    actorEmail: admin.email,
    accion: "Usuario modificado",
    detalle: `${objetivo.email} · ${cambios.join(", ")}`,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PATCH = withApi("PATCH /api/usuarios/[id]", handlerPATCH as never);
