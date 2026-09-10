import "server-only";
import * as argon2 from "@node-rs/argon2";
import bcrypt from "bcryptjs";

/**
 * Las contraseñas nunca se guardan: se guarda un "hash", un resultado
 * irreversible del que no se puede volver a la contraseña original.
 *
 * Se usa **argon2id**, hoy el algoritmo recomendado (ganador del Password
 * Hashing Competition). Los parámetros son los que recomienda OWASP: 19 MiB
 * de memoria y 2 pasadas. Gastar memoria a propósito es lo que hace que
 * probar contraseñas en masa con tarjetas gráficas resulte carísimo.
 */
const OPCIONES_ARGON2 = {
  // 2 = Argon2id. Se escribe el número en lugar de argon2.Algorithm.Argon2id
  // porque ese enum no se puede leer con la configuración de TypeScript de
  // este proyecto (isolatedModules).
  algorithm: 2,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPCIONES_ARGON2);
}

/**
 * Comprueba una contraseña contra el hash guardado. Acepta también los
 * hashes antiguos de bcrypt (los que ya había en la base de datos), para que
 * nadie se quede sin poder entrar: en cuanto acierta, el hash se reescribe
 * en argon2id (ver `necesitaRehash`).
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    if (hash.startsWith("$argon2")) {
      return await argon2.verify(hash, password);
    }
    if (hash.startsWith("$2")) {
      return await bcrypt.compare(password, hash);
    }
    return false;
  } catch {
    return false;
  }
}

/** true si el hash es del formato antiguo y conviene reescribirlo. */
export function necesitaRehash(hash: string): boolean {
  return !hash.startsWith("$argon2");
}

/**
 * Hash "señuelo": cuando alguien intenta entrar con un email que no existe,
 * se compara la contraseña contra este hash inventado. Así la respuesta
 * tarda lo mismo que con un email real y nadie puede averiguar quién está
 * registrado midiendo el tiempo de respuesta.
 *
 * Se calcula una sola vez, sobre una contraseña aleatoria que nadie conoce.
 */
let hashSenuelo: string | null = null;

export async function compararContraSenuelo(password: string): Promise<void> {
  if (!hashSenuelo) {
    const aleatoria = `senuelo-${Math.random()}-${Date.now()}`;
    hashSenuelo = await hashPassword(aleatoria);
  }
  await verifyPassword(hashSenuelo, password).catch(() => false);
}

// Contraseñas que jamás deben permitirse, por muy larga que sea la cadena.
const PROHIBIDAS = new Set([
  "contrasena1",
  "contrasena123",
  "password123",
  "password1234",
  "1234567890",
  "12345678901",
  "qwertyuiop",
  "administrador",
  "novaschool1",
  "novaschool123",
  "crmnovaschool",
  "erasmusplus",
]);

/**
 * Comprueba que una contraseña nueva es aceptable. Devuelve un mensaje de
 * error o null si está bien.
 */
export function validarFortaleza(
  password: string,
  email?: string
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede pasar de ${PASSWORD_MAX_LENGTH} caracteres.`;
  }

  const normalizada = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (PROHIBIDAS.has(normalizada)) {
    return "Esa contraseña es demasiado previsible. Elige otra.";
  }

  // Ni un solo carácter repetido ("aaaaaaaaaa"), ni secuencias evidentes.
  if (/^(.)\1+$/.test(password)) {
    return "Esa contraseña es demasiado previsible. Elige otra.";
  }

  // No puede contener la parte del email anterior a la @.
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
      return "La contraseña no puede contener tu email.";
    }
  }

  return null;
}
