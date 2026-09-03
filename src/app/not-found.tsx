import Link from "next/link";

// Se muestra tanto cuando una dirección no existe como cuando alguien
// intenta abrir una ficha a la que no tiene acceso. El mensaje es el mismo
// en los dos casos a propósito: así nadie puede averiguar si un cliente
// existe probando identificadores en la barra de direcciones.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-brand-navy">
          Aquí no hay nada
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Esta dirección no existe o no tienes acceso a ella.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
