import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  deleteAllSessionsForUser,
  getSession,
} from "@/lib/session";
import {
  hashPassword,
  validarFortaleza,
  verifyPassword,
  PASSWORD_MAX_LENGTH,
} from "@/lib/passwords";
import { registrarEventoSistema } from "@/lib/audit";
import {
  DEMASIADO_GRANDE,
  getClientIp,
  getUserAgent,
  readJsonBody,
} from "@/lib/request";
import { requireSameOrigin } from "@/lib/csrf";
import { comprobarLimiteMemoria } from "@/lib/rate-limit";
import { withApi } from "@/lib/http";

const schema = z.object({
  actual: z.string().min(1, "Escribe tu contraseña actual.").max(PASSWORD_MAX_LENGTH),
  nueva: z.string().min(1, "Escribe la contraseña nueva.").max(PASSWORD_MAX_LENGTH),
});

/** Cambia la contraseña del usuario que está dentro del CRM. */
async function handlerPOST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Tope de intentos: evita que alguien con acceso momentáneo al ordenador
  // vaya adivinando la contraseña actual desde esta pantalla.
  const limite = comprobarLimiteMemoria(`password:${user.id}`, 10, 900);
  if (limite.bloqueado) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request, 8 * 1024);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 413 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const registro = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, email: true },
  });
  if (!registro) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const correcta = await verifyPassword(registro.passwordHash, parsed.data.actual);
  if (!correcta) {
    await registrarEventoSistema({
      actorId: user.id,
      actorEmail: user.email,
      accion: "Cambio de contraseña fallido (contraseña actual incorrecta)",
      ip: getClientIp(request),
    });
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 400 }
    );
  }

  const problema = validarFortaleza(parsed.data.nueva, registro.email);
  if (problema) {
    return NextResponse.json({ error: problema }, { status: 400 });
  }

  if (parsed.data.nueva === parsed.data.actual) {
    return NextResponse.json(
      { error: "La contraseña nueva debe ser distinta de la actual." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.nueva),
      debeCambiarPassword: false,
      passwordUpdatedAt: new Date(),
    },
  });

  // Al cambiar la contraseña se cierran TODAS las sesiones (por si alguien
  // había entrado con la contraseña antigua) y se abre una nueva para este
  // navegador, de forma que quien hace el cambio no se queda fuera.
  await deleteAllSessionsForUser(user.id);
  await createSession(user.id, {
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  await registrarEventoSistema({
    actorId: user.id,
    actorEmail: user.email,
    accion: "Contraseña cambiada (todas las sesiones cerradas)",
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/auth/password", handlerPOST as never);
