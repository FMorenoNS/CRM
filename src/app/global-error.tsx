"use client";

// Red de seguridad de último nivel: se usa si el fallo ocurre tan arriba que
// ni el layout principal ha podido cargar. Por eso incluye <html> y <body>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          color: "#111827",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 32 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>
            El CRM no está disponible ahora mismo
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#4b5563" }}>
            Vuelve a cargar la página en unos segundos.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
              Código para IT: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
