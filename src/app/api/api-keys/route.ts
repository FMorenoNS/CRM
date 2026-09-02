import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { generateApiKey } from "@/lib/api-keys";

const createSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  userId: z.string().trim().min(1, "Selecciona a qué usuario representa."),
});

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const { token, hash } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      nombre: parsed.data.nombre,
      hash,
      userId: parsed.data.userId,
    },
  });

  // El token en claro solo se devuelve aquí, una única vez: no se guarda en
  // ningún sitio (solo su hash), así que si se pierde hay que crear otra clave.
  return NextResponse.json({ id: apiKey.id, token });
}
