import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Si ya hay una sesión válida (comprobada contra la base de datos), no
  // tiene sentido mostrar el formulario. Esta comprobación vive aquí y no en
  // el middleware porque el middleware no puede consultar la base de datos.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy">
      <div className="flex flex-col items-center gap-6 rounded-lg bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-brand-navy">
            CRM Erasmus+ Novaschool
          </h1>
          <p className="text-sm text-gray-500">
            Residencia de Granada · acceso interno
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
