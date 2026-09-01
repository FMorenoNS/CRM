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
  } = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
