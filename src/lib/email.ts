import "server-only";

/**
 * Integración con Microsoft 365 (Microsoft Graph API) para el envío de
 * presupuestos y contratos por correo.
 *
 * PENDIENTE de configuración por IT de Novaschool:
 *  1. Registrar una aplicación en Azure AD (Azure Portal → App registrations).
 *  2. Concederle el permiso de aplicación `Mail.Send` (con consentimiento de admin),
 *     idealmente limitado a la cuenta remitente con una Application Access Policy.
 *  3. Crear un secreto de cliente y rellenar las variables de entorno:
 *     AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_SENDER_EMAIL.
 *
 * Mientras estas variables estén vacías, el envío queda deshabilitado en la UI
 * y esta función lanza un error controlado.
 */

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.AZURE_TENANT_ID &&
      process.env.AZURE_SENDER_EMAIL
  );
}

type SendArgs = {
  to: string;
  subject: string;
  bodyHtml: string;
  attachment?: { filename: string; contentBase64: string; contentType: string };
};

async function getGraphToken(): Promise<string> {
  const tenant = process.env.AZURE_TENANT_ID!;
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    }
  );
  if (!res.ok) {
    throw new Error("No se pudo obtener el token de Microsoft Graph.");
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function sendDocumentEmail(args: SendArgs): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "El envío de correo aún no está configurado. IT debe registrar la app en Azure AD."
    );
  }

  const token = await getGraphToken();
  const sender = process.env.AZURE_SENDER_EMAIL!;

  const message: Record<string, unknown> = {
    subject: args.subject,
    body: { contentType: "HTML", content: args.bodyHtml },
    toRecipients: [{ emailAddress: { address: args.to } }],
  };

  if (args.attachment) {
    message.attachments = [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: args.attachment.filename,
        contentType: args.attachment.contentType,
        contentBytes: args.attachment.contentBase64,
      },
    ];
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (!res.ok) {
    throw new Error("Microsoft Graph rechazó el envío del correo.");
  }
}
