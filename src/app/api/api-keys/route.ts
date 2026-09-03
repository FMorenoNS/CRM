import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { generateApiKey } from "@/lib/api-keys";
import { registrarEventoSistema } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const createSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  userId: z.string().trim().min(1, "Selecciona a qué usuario representa."),
});

async function handlerPOST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
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

  await registrarEventoSistema({
    actorId: auth.id,
    actorEmail: auth.email,
    accion: "Clave de API creada",
    detalle: `${apiKey.nombre} · actúa como ${user.email}`,
    ip: getClientIp(request),
  });

  // El token en claro solo se devuelve aquí, una única vez: no se guarda en
  // ningún sitio (solo su hash), así que si se pierde hay que crear otra clave.
  return NextResponse.json({ id: apiKey.id, token });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/api-keys", handlerPOST as never);
