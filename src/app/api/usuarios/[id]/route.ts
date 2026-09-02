import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "MARKETING", "DIRECCION"]).optional(),
  activo: z.boolean().optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .optional(),
  centroIds: z.array(z.string()).optional(),
  centroAsignado: z
    .enum(["OPENWORLD", "MEDINA_ELVIRA"])
    .optional()
    .nullable()
    .or(z.literal("")),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const data: {
    role?: "ADMIN" | "MARKETING" | "DIRECCION";
    activo?: boolean;
    passwordHash?: string;
    centros?: { set: { id: string }[] };
    centroAsignado?: "OPENWORLD" | "MEDINA_ELVIRA" | null;
  } = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  if (parsed.data.centroIds) {
    data.centros = { set: parsed.data.centroIds.map((cid) => ({ id: cid })) };
  }
  if (parsed.data.centroAsignado !== undefined) {
    data.centroAsignado = parsed.data.centroAsignado || null;
  }

  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
