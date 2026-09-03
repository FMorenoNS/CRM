import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/session";

// ADMIN y MARKETING ven todos los clientes. DIRECCION solo ve los suyos
// (session.centroIds).
export function hasGlobalVisibility(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "MARKETING";
}

export function canAccessCentro(user: SessionUser, centroId: string): boolean {
  if (hasGlobalVisibility(user)) return true;
  return user.centroIds.includes(centroId);
}

// Filtro Prisma para listados de Centro: `undefined` = sin restricción (ve
// todos). Para Estancia/Contacto/etc. usar { centroId: { in: user.centroIds } }
// o { centro: { id: { in: user.centroIds } } } con el mismo criterio.
export function centroVisibilityFilter(user: SessionUser) {
  if (hasGlobalVisibility(user)) return undefined;
  return { id: { in: user.centroIds } };
}

// Acciones operativas del día a día: registrar interacciones, enviar
// documentos, mover la pipeline, dar de alta un cliente o una estancia.
// Admin y Marketing siempre pueden; Dirección solo dentro de su(s)
// cliente(s) asignado(s).
export function canDoOperational(user: SessionUser, centroId: string): boolean {
  if (user.role === "ADMIN" || user.role === "MARKETING") return true;
  if (user.role === "DIRECCION") return user.centroIds.includes(centroId);
  return false;
}

// Edición de datos maestros: editar/borrar el cliente, sus contactos o sus
// estancias. Marketing NO puede; Admin siempre puede; Dirección solo en
// su(s) cliente(s) asignado(s).
export function canEditMasterData(user: SessionUser, centroId: string): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "DIRECCION") return user.centroIds.includes(centroId);
  return false;
}

/**
 * Se usa cuando el motivo del rechazo es el ROL, no la visibilidad: la
 * persona sí puede ver ese cliente, pero su rol no le permite esta acción
 * concreta (por ejemplo, Marketing editando los datos maestros de un cliente
 * que tiene delante en la lista). Ahí el mensaje explícito es útil y no
 * revela nada que la persona no supiera ya.
 */
export function forbidden(mensaje = "No tienes permiso para realizar esta acción.") {
  return NextResponse.json({ error: mensaje }, { status: 403 });
}

/**
 * Se usa cuando el motivo del rechazo es la VISIBILIDAD: el registro existe,
 * pero no pertenece a ningún cliente de esta persona.
 *
 * Responde exactamente lo mismo que si el registro no existiera, y a
 * propósito: si un rechazo por visibilidad devolviera 403 y una ficha
 * inexistente devolviera 404, cualquiera con una cuenta de Dirección podría
 * ir probando identificadores en la API y averiguar qué clientes y estancias
 * hay en la cartera de los demás, sin llegar a ver los datos pero sabiendo
 * que existen.
 *
 * Para que las dos situaciones sean indistinguibles de verdad, esta misma
 * función se usa TAMBIÉN para el "no existe" de cada ruta: así el cuerpo y
 * el código de estado son idénticos por construcción, y no por que alguien
 * se acuerde de mantenerlos iguales.
 */
export function noEncontrado() {
  return NextResponse.json({ error: "No se ha encontrado." }, { status: 404 });
}
