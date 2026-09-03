import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, purgeExpiredSessions } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import {
  compararContraSenuelo,
  hashPassword,
  necesitaRehash,
  verifyPassword,
} from "@/lib/passwords";
import {
  comprobarLimiteLogin,
  comprobarLimiteMemoria,
  limpiarIntentosLogin,
  purgarIntentosAntiguos,
  registrarIntentoLogin,
} from "@/lib/rate-limit";
import { registrarEventoSistema } from "@/lib/audit";
import { requireSameOrigin } from "@/lib/csrf";
import { purgarHistorialAntiguo } from "@/lib/audit";
import { withApi } from "@/lib/http";
import {
  DEMASIADO_GRANDE,
  getClientIp,
  getUserAgent,
  readJsonBody,
} from "@/lib/request";

// Un único mensaje para TODOS los fallos de acceso. Nunca se dice si el
// email existe, si la cuenta está desactivada o si la contraseña es la que
// falla: eso permitiría a alguien de fuera ir descubriendo qué emails están
// registrados en el CRM.
const MENSAJE_GENERICO = "Email o contraseña incorrectos.";

function respuestaGenerica() {
  return NextResponse.json({ error: MENSAJE_GENERICO }, { status: 401 });
}

async function handlerPOST(request: Request) {
  // El intento de acceso debe venir del propio CRM, no de otra web.
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const ip = getClientIp(request);

  // Tope de peticiones por IP, antes de tocar la base de datos.
  //
  // El login es la única ruta que no pasa por requireApiUser, que es donde
  // vive el tope general, así que se le pone aquí el suyo. Y hace falta por
  // un motivo concreto: cada intento con un email desconocido dispara a
  // propósito un cálculo de argon2id de 19 MiB (el hash señuelo que iguala
  // los tiempos de respuesta). Eso está bien y es lo que cierra la fuga de
  // quién está registrado, pero convierte cada petición sin autenticar en
  // trabajo caro para el servidor. Sin este tope, quien quisiera tumbar el
  // CRM solo tendría que pedir el login en bucle.
  //
  // 30 por minuto es holgadísimo para una persona escribiendo su contraseña
  // y a la vez corta en seco cualquier automatismo.
  const limiteIp = comprobarLimiteMemoria(`login:${ip}`, 30, 60);
  if (limiteIp.bloqueado) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera unos segundos." },
      {
        status: 429,
        headers: { "Retry-After": String(limiteIp.segundosEspera) },
      }
    );
  }

  const body = await readJsonBody(request, 8 * 1024);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 413 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    // Ni siquiera se detalla qué campo falla, por el mismo motivo.
    return respuestaGenerica();
  }

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  // 1) ¿Demasiados intentos fallidos recientes? Se corta antes de tocar la
  //    tabla de usuarios.
  const limite = await comprobarLimiteLogin(email, ip);
  if (limite.bloqueado) {
    await registrarEventoSistema({
      actorEmail: email,
      accion: "Acceso bloqueado por demasiados intentos",
      ip,
    });
    const minutos = Math.ceil(limite.segundosEspera / 60);
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Vuelve a probar en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limite.segundosEspera) },
      }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // 2) Si el email no existe (o la cuenta está desactivada), se comprueba la
  //    contraseña contra un hash señuelo. No sirve para nada salvo para que
  //    la respuesta tarde exactamente lo mismo que con un email real: sin
  //    esto, la diferencia de milisegundos delataría qué emails existen.
  if (!user || !user.activo) {
    await compararContraSenuelo(password);
    await registrarIntentoLogin(email, ip, false);
    await registrarEventoSistema({
      actorId: user?.id ?? null,
      actorEmail: email,
      accion: user
        ? "Intento de acceso a cuenta desactivada"
        : "Intento de acceso con email desconocido",
      ip,
    });
    return respuestaGenerica();
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    await registrarIntentoLogin(email, ip, false);
    await registrarEventoSistema({
      actorId: user.id,
      actorEmail: email,
      accion: "Intento de acceso con contraseña incorrecta",
      ip,
    });
    return respuestaGenerica();
  }

  // 3) Acceso correcto.
  // Si el hash era del formato antiguo (bcrypt), se reescribe en argon2id
  // aprovechando que aquí sí tenemos la contraseña en claro un instante.
  if (necesitaRehash(user.passwordHash)) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      })
      .catch(() => {});
  }

  await limpiarIntentosLogin(email);
  await createSession(user.id, { ip, userAgent: getUserAgent(request) });

  await registrarEventoSistema({
    actorId: user.id,
    actorEmail: user.email,
    accion: "Inicio de sesión",
    ip,
  });

  // Mantenimiento oportunista: aprovechando que alguien acaba de entrar, se
  // limpian sesiones caducadas, intentos viejos e historial fuera de plazo.
  // Es barato y evita depender de una tarea programada externa.
  void Promise.all([
    purgeExpiredSessions(),
    purgarIntentosAntiguos(),
    purgarHistorialAntiguo(),
  ]).catch(() => {});

  return NextResponse.json({
    ok: true,
    debeCambiarPassword: user.debeCambiarPassword,
  });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/auth/login", handlerPOST as never);
