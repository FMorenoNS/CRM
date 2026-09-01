import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { UsuariosClient, type UsuarioRow } from "./usuarios-client";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const usuarios = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nombre: true,
      email: true,
      role: true,
      activo: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
      <p className="mt-1 text-sm text-gray-500">
        Solo el administrador puede crear cuentas y cambiar contraseñas.
      </p>
      <div className="mt-6">
        <UsuariosClient usuarios={usuarios as UsuarioRow[]} />
      </div>
    </div>
  );
}
