import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS } from "@/lib/labels";
import { isEmailConfigured } from "@/lib/email";
import { plazasLibres } from "@/lib/habitaciones";
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
import {
  Participantes,
  type ParticipanteItem,
  type HabitacionOption,
} from "@/app/(app)/estancias/[id]/participantes";

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
      participantes: {
        orderBy: { createdAt: "asc" },
        include: { habitacion: { select: { nombre: true } } },
      },
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

  const participantes: ParticipanteItem[] = estancia.participantes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    rol: p.rol,
    habitacionId: p.habitacionId,
    habitacionNombre: p.habitacion?.nombre ?? null,
  }));

  const habitacionesActivas = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  const habitacionesDisponibles: HabitacionOption[] = await Promise.all(
    habitacionesActivas.map(async (h) => ({
      id: h.id,
      nombre: h.nombre,
      plazasLibres: await plazasLibres(h.id, estancia.fechaInicio, estancia.fechaFin),
    }))
  );
  const totalLibres = habitacionesDisponibles.reduce(
    (suma, h) => suma + Math.max(0, h.plazasLibres),
    0
  );
  const necesarios = {
    alumnos: estancia.numeroAlumnos ?? 0,
    profesores: estancia.numeroProfesores ?? 0,
  };

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
              numeroProfesores:
                estancia.numeroProfesores !== null
                  ? String(estancia.numeroProfesores)
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

      <section>
        <h3 className="text-base font-medium text-gray-900">
          Participantes y habitaciones
        </h3>
        <div className="mt-4">
          <Participantes
            estanciaId={estancia.id}
            participantes={participantes}
            habitaciones={habitacionesDisponibles}
            necesarios={necesarios}
            totalLibres={totalLibres}
          />
        </div>
      </section>
    </div>
  );
}
