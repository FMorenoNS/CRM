import { LoginForm } from "./login-form";

export default function LoginPage() {
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
