import "server-only";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// 1) Límite de intentos de inicio de sesión (guardado en la base de datos)
// ---------------------------------------------------------------------------
// Se guarda en la base de datos, no en memoria, para que el contador
// sobreviva a un reinicio del servidor: si no, bastaría con esperar un
// reinicio (o dar con otra instancia) para seguir probando contraseñas.

const VENTANA_MINUTOS = 15;
// Fallos permitidos con un mismo email antes de bloquear 15 minutos. Es
// deliberadamente generoso para que nadie pueda dejar fuera a un compañero
// llenando el contador a propósito: el bloqueo es temporal y corto.
const MAX_FALLOS_POR_EMAIL = 8;
// Fallos permitidos desde una misma IP (frena a quien prueba muchos emails).
const MAX_FALLOS_POR_IP = 25;

export type ResultadoLimite =
  | { bloqueado: false }
  | { bloqueado: true; segundosEspera: number };

export async function comprobarLimiteLogin(
  email: string,
  ip: string
): Promise<ResultadoLimite> {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000);

  const [porEmail, porIp] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { email, exito: false, createdAt: { gte: desde } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loginAttempt.count({
      where: { ip, exito: false, createdAt: { gte: desde } },
    }),
  ]);

  const superaEmail = porEmail.length >= MAX_FALLOS_POR_EMAIL;
  const superaIp = porIp >= MAX_FALLOS_POR_IP;

  if (!superaEmail && !superaIp) return { bloqueado: false };

  // El bloqueo se levanta cuando el fallo más antiguo de la ventana sale de
  // ella (no es un castigo fijo: se va soltando poco a poco).
  const masAntiguo = porEmail[0]?.createdAt ?? desde;
  const liberaEn = masAntiguo.getTime() + VENTANA_MINUTOS * 60 * 1000;
  const segundosEspera = Math.max(
    60,
    Math.ceil((liberaEn - Date.now()) / 1000)
  );

  return { bloqueado: true, segundosEspera };
}

export async function registrarIntentoLogin(
  email: string,
  ip: string,
  exito: boolean
): Promise<void> {
  await prisma.loginAttempt
    .create({ data: { email: email.slice(0, 200), ip, exito } })
    .catch(() => {});
}

/** Al acertar la contraseña se limpia el contador de ese email. */
export async function limpiarIntentosLogin(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } }).catch(() => {});
}

/** Borra los intentos con más de 30 días (no hacen falta más allá). */
export async function purgarIntentosAntiguos(): Promise<number> {
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: limite } },
  });
  return count;
}

// ---------------------------------------------------------------------------
// 2) Límite general de peticiones (en memoria)
// ---------------------------------------------------------------------------
// Para el resto de la API basta un contador en memoria: protege de un bucle
// desbocado o de un script abusivo. Al ser en memoria, se reinicia con el
// servidor y no se comparte entre varias copias del proceso; si algún día el
// CRM se despliega en varias instancias, el límite de verdad debe ponerlo el
// proxy inverso (Nginx, Cloudflare...). El límite de LOGIN de arriba, que es
// el crítico, sí está en base de datos.

type Contador = { hasta: number; usos: number };
const contadores = new Map<string, Contador>();
let ultimaLimpieza = Date.now();

// Tope duro de claves distintas en memoria. La IP se lee de una cabecera que
// el cliente puede falsear si el CRM quedara expuesto sin proxy delante, así
// que alguien podría inventarse una IP nueva en cada petición y hacer crecer
// este mapa hasta agotar la memoria. Con el tope, el propio mecanismo de
// protección no se convierte en un problema.
const MAX_CLAVES = 20_000;

export function comprobarLimiteMemoria(
  clave: string,
  maxPeticiones: number,
  ventanaSegundos: number
): ResultadoLimite {
  const ahora = Date.now();

  // Limpieza periódica para que el mapa no crezca sin fin.
  if (ahora - ultimaLimpieza > 60_000) {
    for (const [k, v] of contadores) if (v.hasta <= ahora) contadores.delete(k);
    ultimaLimpieza = ahora;
  }

  // Si aun así se ha llegado al tope, se descartan las entradas más antiguas
  // (las primeras del mapa: JavaScript conserva el orden de inserción).
  if (contadores.size >= MAX_CLAVES && !contadores.has(clave)) {
    let porBorrar = Math.ceil(MAX_CLAVES / 10);
    for (const k of contadores.keys()) {
      contadores.delete(k);
      if (--porBorrar <= 0) break;
    }
  }

  const actual = contadores.get(clave);
  if (!actual || actual.hasta <= ahora) {
    contadores.set(clave, { hasta: ahora + ventanaSegundos * 1000, usos: 1 });
    return { bloqueado: false };
  }

  actual.usos += 1;
  if (actual.usos > maxPeticiones) {
    return {
      bloqueado: true,
      segundosEspera: Math.max(1, Math.ceil((actual.hasta - ahora) / 1000)),
    };
  }
  return { bloqueado: false };
}
