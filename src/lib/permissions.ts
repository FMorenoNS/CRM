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

export function forbidden(mensaje = "No tienes permiso para realizar esta acción.") {
  return NextResponse.json({ error: mensaje }, { status: 403 });
}
