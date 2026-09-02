import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { UsuariosClient, type UsuarioRow } from "./usuarios-client";
import { ApiKeysClient, type ApiKeyRow } from "./api-keys-client";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const [usuariosRaw, clientes, apiKeysRaw] = await Promise.all([
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
    prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { nombre: true } } },
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

  const apiKeys: ApiKeyRow[] = apiKeysRaw.map((k) => ({
    id: k.id,
    nombre: k.nombre,
    activo: k.activo,
    usuarioNombre: k.user.nombre,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-10">
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

      <div>
        <h2 className="text-xl font-semibold text-gray-900">Claves de API</h2>
        <p className="mt-1 text-sm text-gray-500">
          Para integraciones externas (por ejemplo, el bot de captación de
          Facebook). Cada clave actúa como el usuario al que está vinculada:
          hereda su rol y sus clientes asignados.
        </p>
        <div className="mt-6">
          <ApiKeysClient
            apiKeys={apiKeys}
            usuarios={usuariosRaw
              .filter((u) => u.activo)
              .map((u) => ({ id: u.id, nombre: u.nombre, role: u.role }))}
          />
        </div>
      </div>
    </div>
  );
}
