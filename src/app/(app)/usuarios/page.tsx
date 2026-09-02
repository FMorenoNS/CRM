import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { UsuariosClient, type UsuarioRow } from "./usuarios-client";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const [usuariosRaw, clientes] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        activo: true,
        centros: { select: { id: true } },
        centroAsignado: true,
      },
    }),
    prisma.centro.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const usuarios: UsuarioRow[] = usuariosRaw.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    role: u.role,
    activo: u.activo,
    centroIds: u.centros.map((c) => c.id),
    centroAsignado: u.centroAsignado,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
      <p className="mt-1 text-sm text-gray-500">
        Solo el administrador puede crear cuentas y cambiar contraseñas. El
        rol Dirección solo ve y edita los clientes que tenga asignados.
      </p>
      <div className="mt-6">
        <UsuariosClient
          usuarios={usuarios}
          clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre || "(sin nombre)" }))}
        />
      </div>
    </div>
  );
}
