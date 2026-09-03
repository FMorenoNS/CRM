import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS } from "@/lib/labels";
import { isEmailConfigured } from "@/lib/email";
import { EstanciaForm } from "@/app/(app)/estancias/estancia-form";
import {
  Interacciones,
  type InteraccionItem,
} from "@/app/(app)/estancias/[id]/interacciones";
import { DeleteEstanciaButton } from "@/app/(app)/estancias/[id]/estancia-actions";
import {
  EnviarDocumento,
  type DocumentoItem,
} from "@/app/(app)/estancias/[id]/enviar-documento";
import {
  CaptacionFacebook,
  type CaptacionData,
} from "@/app/(app)/estancias/[id]/captacion-facebook";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function EstanciaPanel({
  estanciaId,
  puedeEditar,
}: {
  estanciaId: string;
  puedeEditar: boolean;
}) {
  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    include: {
      centro: {
        select: {
          id: true,
          // Todos los contactos con email: son las únicas direcciones a
          // las que el CRM acepta enviar documentos, así que el desplegable
          // tiene que ofrecerlas todas.
          contactos: {
            where: { email: { not: null } },
            select: { nombre: true, email: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      interacciones: {
        orderBy: { fecha: "desc" },
        include: { autor: { select: { nombre: true } } },
      },
      documentosEnviados: { orderBy: { enviadoEn: "desc" } },
    },
  });

  if (!estancia) {
    return (
      <p className="text-sm text-gray-500">
        No se encontró la estancia seleccionada.
      </p>
    );
  }

  const documentos: DocumentoItem[] = estancia.documentosEnviados.map((d) => ({
    id: d.id,
    tipo: d.tipo,
    destinatario: d.destinatario,
    enviadoEn: d.enviadoEn.toISOString(),
    exito: d.exito,
  }));

  const capturaFb = estancia.interacciones.find(
    (i) => i.tipo === "CAPTACION_FACEBOOK"
  );
  const captacionData: CaptacionData = {
    grupoUrl: capturaFb?.grupoUrl ?? null,
    perfilUrl: capturaFb?.perfilUrl ?? null,
    capturaBase64: capturaFb?.capturaBase64 ?? null,
    mensajeContacto: capturaFb?.mensajeContacto ?? null,
    exists: Boolean(capturaFb),
  };

  const interacciones: InteraccionItem[] = estancia.interacciones
    .filter((i) => i.tipo !== "CAPTACION_FACEBOOK")
    .map((i) => ({
      id: i.id,
      tipo: i.tipo,
      resumen: i.resumen,
      fecha: i.fecha.toISOString(),
      autorNombre: i.autor.nombre,
    }));

  return (
    <div className="flex flex-col gap-8 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <span className="inline-block rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-medium text-brand-navy">
          {ESTADO_LABELS[estancia.estado]}
          {!estancia.activo && " · inactiva"}
        </span>
        {puedeEditar && (
          <DeleteEstanciaButton
            estanciaId={estancia.id}
            centroId={estancia.centro.id}
          />
        )}
      </div>

      <section>
        <h3 className="text-base font-medium text-gray-900">
          Datos de la estancia
        </h3>
        <div className="mt-4">
          <EstanciaForm
            mode="edit"
            estanciaId={estancia.id}
            readOnly={!puedeEditar}
            defaultValues={{
              tipoPrograma: estancia.tipoPrograma,
              tipoProyecto: estancia.tipoProyecto,
              tipoParticipante: estancia.tipoParticipante,
              centroReceptor: estancia.centroReceptor,
              provincia: estancia.provincia,
              numeroAlumnos:
                estancia.numeroAlumnos !== null
                  ? String(estancia.numeroAlumnos)
                  : "",
              edadGrupo: estancia.edadGrupo,
              fechaInicio: toDateInput(estancia.fechaInicio),
              fechaFin: toDateInput(estancia.fechaFin),
              estado: estancia.estado,
              presupuestoImporte: estancia.presupuestoImporte
                ? estancia.presupuestoImporte.toString()
                : "",
              notas: estancia.notas,
            }}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium text-gray-900">
          Presupuesto / contrato
        </h3>
        <div className="mt-4">
          <EnviarDocumento
            estanciaId={estancia.id}
            emailConfigured={isEmailConfigured()}
            destinatarios={estancia.centro.contactos.map((c) => ({
              nombre: c.nombre,
              email: c.email as string,
            }))}
            documentos={documentos}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium text-gray-900">
          Historial de interacciones
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          <CaptacionFacebook estanciaId={estancia.id} data={captacionData} />
          <Interacciones
            estanciaId={estancia.id}
            interacciones={interacciones}
          />
        </div>
      </section>
    </div>
  );
}
