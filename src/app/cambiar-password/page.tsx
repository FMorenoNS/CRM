import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import { CambiarPasswordForm } from "./form";

// Esta pantalla vive fuera del grupo (app) a propósito: si estuviera dentro,
// el propio layout que obliga a cambiar la contraseña la redirigiría a sí
// misma en bucle.
export default async function CambiarPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const obligatorio = session.debeCambiarPassword;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-brand-navy">
          {obligatorio ? "Elige tu contraseña" : "Cambiar contraseña"}
        </h1>
        {obligatorio ? (
          <p className="mt-1 text-sm text-gray-600">
            Un administrador te ha asignado una contraseña temporal. Antes de
            entrar al CRM tienes que elegir una propia.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            Al cambiarla se cerrará la sesión en el resto de tus dispositivos.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Mínimo {PASSWORD_MIN_LENGTH} caracteres. No puede contener tu email.
        </p>

        <div className="mt-6">
          <CambiarPasswordForm />
        </div>

        {!obligatorio && (
          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-gray-500 hover:text-brand-navy">
              Volver al CRM
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
