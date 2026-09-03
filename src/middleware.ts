import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "session";
const PUBLIC_ROUTES = ["/login"];

/**
 * Construye la Content-Security-Policy: la lista blanca de lo que el
 * navegador tiene permitido cargar o ejecutar en la página. Es la defensa de
 * último recurso contra XSS: aunque alguien lograra colar un `<script>` en
 * un campo del CRM, el navegador se negaría a ejecutarlo porque no lleva el
 * "nonce" (un código aleatorio distinto en cada carga que solo conoce el
 * servidor).
 *
 * En desarrollo se relaja lo justo para que funcione la recarga en caliente
 * de Next.js, que necesita evaluar código al vuelo.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Hojas de estilo propias (Tailwind se compila a un fichero, no en línea).
    // En producción NO se permite ningún estilo en línea. En desarrollo hay
    // que permitirlos porque el panel de depuración de Next.js inyecta los
    // suyos; comprobado que en producción no hace falta.
    isDev
      ? `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`
      : `style-src 'self' 'nonce-${nonce}'`,
    // Los estilos que React aplica elemento a elemento van aparte: el CRM no
    // usa ninguno, pero Next puede añadirlos, y permitirlos aquí NO abre la
    // puerta a hojas de estilo inyectadas.
    "style-src-attr 'unsafe-inline'",
    // data: es necesario para las capturas de pantalla de la captación, que
    // se guardan incrustadas en la propia base de datos.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // El CRM solo habla con su propio servidor.
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    // Los formularios solo pueden enviarse al propio CRM.
    "form-action 'self'",
    // Nadie puede incrustar el CRM en un iframe...
    "frame-ancestors 'none'",
    // ...ni el CRM incrusta nada externo.
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "worker-src 'self' blob:",
    // Cualquier recurso pedido por http:// se reintenta por https://.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== "production";

  // Nonce aleatorio para esta carga concreta.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);

  // Puerta de entrada rápida: si no hay ni cookie de sesión, no hace falta
  // consultar la base de datos para saber que hay que ir al login.
  //
  // OJO: esto es solo una comprobación superficial de "hay cookie", pensada
  // para ahorrar trabajo y redirigir cómodamente. La comprobación DE VERDAD
  // (que la sesión existe, no ha caducado y el usuario sigue activo) la hace
  // el servidor en cada página y en cada ruta de la API con getSession().
  // El middleware nunca decide permisos por sí solo.
  const tieneCookie = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  const esRutaPublica = PUBLIC_ROUTES.includes(pathname);

  if (!tieneCookie && !esRutaPublica) {
    const url = new URL("/login", req.nextUrl);
    return NextResponse.redirect(url);
  }

  // Se pasa el nonce a Next por las cabeceras de la petición para que lo
  // ponga en las etiquetas <script> que genera.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
