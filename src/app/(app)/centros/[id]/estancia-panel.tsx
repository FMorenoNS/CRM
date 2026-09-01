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

export async function EstanciaPanel({ estanciaId }: { estanciaId: string }) {
  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    include: {
      centro: {
        select: {
          id: true,
          contactos: {
            where: { email: { not: null } },
            select: { email: true },
            take: 1,
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
        <DeleteEstanciaButton
          estanciaId={estancia.id}
          centroId={estancia.centro.id}
        />
      </div>

      <section>
        <h3 className="text-base font-medium text-gray-900">
          Datos de la estancia
        </h3>
        <div className="mt-4">
          <EstanciaForm
            mode="edit"
            estanciaId={estancia.id}
            defaultValues={{
              tipoPrograma: estancia.tipoPrograma,
              tipoParticipante: estancia.tipoParticipante,
              centroReceptor: estancia.centroReceptor,
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
            defaultEmail={estancia.centro.contactos[0]?.email ?? ""}
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
