import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS } from "@/lib/labels";
import { isEmailConfigured } from "@/lib/email";
import { plazasLibres, rolQueOcupa } from "@/lib/habitaciones";
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
import type { PresupuestoGuardado } from "@/app/(app)/estancias/[id]/presupuesto-modal";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

// Construye el contenido de las pestañas "Estancia" y "Participantes" de la
// ficha del cliente. Sigue siendo una sola consulta/cálculo (igual que
// antes, cuando todo vivía en una sola pestaña): solo cambia cómo se
// reparte el JSX resultante entre las dos pestañas.
export async function buildEstanciaBloques({
  estanciaId,
  puedeEditar,
  sesion,
}: {
  estanciaId: string;
  puedeEditar: boolean;
  sesion: {
    userId: string;
    centroAsignado: "OPENWORLD" | "MEDINA_ELVIRA" | "ANORETA" | null;
  };
}): Promise<{ estancia: ReactNode; participantes: ReactNode }> {
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
      presupuesto: {
        include: {
          lineas: { orderBy: { orden: "asc" } },
          actualizadoPor: { select: { nombre: true } },
          validadoPor: { select: { nombre: true } },
        },
      },
      participantes: {
        orderBy: { createdAt: "asc" },
        include: { habitacion: { select: { nombre: true } } },
      },
    },
  });

  if (!estancia) {
    const noEncontrada = (
      <p className="text-sm text-gray-500">
        No se encontró la estancia seleccionada.
      </p>
    );
    return { estancia: noEncontrada, participantes: noEncontrada };
  }

  const documentos: DocumentoItem[] = estancia.documentosEnviados.map((d) => ({
    id: d.id,
    tipo: d.tipo,
    destinatario: d.destinatario,
    enviadoEn: d.enviadoEn.toISOString(),
    exito: d.exito,
  }));

  // Puede darle el visto bueno quien pertenezca a uno de los centros
  // marcados en el presupuesto, no sea quien lo preparó, y todavía no esté
  // validado.
  const puedeValidar = Boolean(
    estancia.presupuesto &&
      !estancia.presupuesto.validadoPorId &&
      sesion.centroAsignado &&
      estancia.presupuesto.centrosNovaschool.includes(sesion.centroAsignado) &&
      estancia.presupuesto.actualizadoPorId !== sesion.userId
  );

  // Los Decimal de Prisma no cruzan al navegador: se pasan como números.
  const presupuesto: PresupuestoGuardado | null = estancia.presupuesto
    ? {
        numAlumnos: estancia.presupuesto.numAlumnos,
        numProfesores: estancia.presupuesto.numProfesores,
        numMonitores: estancia.presupuesto.numMonitores,
        margenPct: Number(estancia.presupuesto.margenPct),
        ivaPct: Number(estancia.presupuesto.ivaPct),
        total: Number(estancia.presupuesto.total),
        notas: estancia.presupuesto.notas,
        actualizadoEn: estancia.presupuesto.updatedAt.toISOString(),
        actualizadoPor: estancia.presupuesto.actualizadoPor?.nombre ?? null,
        centrosNovaschool: estancia.presupuesto.centrosNovaschool,
        validadoPor: estancia.presupuesto.validadoPor?.nombre ?? null,
        validadoEn: estancia.presupuesto.validadoEn
          ? estancia.presupuesto.validadoEn.toISOString()
          : null,
        puedeValidar,
        lineas: estancia.presupuesto.lineas.map((l) => ({
          tipo: l.tipo,
          codigo: l.codigo,
          precioUnitario: Number(l.precioUnitario),
          dias: l.dias,
          cantidad: l.cantidad,
        })),
      }
    : null;

  const presupuestoValidado = Boolean(estancia.presupuesto?.validadoPorId);

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
    fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.toISOString().slice(0, 10) : null,
    alergias: p.alergias,
    contactoEmergenciaNombre: p.contactoEmergenciaNombre,
    contactoEmergenciaTelefono: p.contactoEmergenciaTelefono,
    autorizacionRecibida: p.autorizacionRecibida,
    seguroRecibido: p.seguroRecibido,
  }));

  const habitacionesActivas = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  const habitacionesDisponibles: HabitacionOption[] = await Promise.all(
    habitacionesActivas.map(async (h) => {
      const rolOcupante = await rolQueOcupa(h.id, estancia.fechaInicio, estancia.fechaFin);
      return {
        id: h.id,
        nombre: h.nombre,
        plazasLibres: await plazasLibres(h.id, estancia.fechaInicio, estancia.fechaFin),
        rolOcupante: rolOcupante === "MIXTA" ? null : rolOcupante,
      };
    })
  );
  const totalLibres = habitacionesDisponibles.reduce(
    (suma, h) => suma + Math.max(0, h.plazasLibres),
    0
  );
  const necesarios = {
    alumnos: estancia.numeroAlumnos ?? 0,
    profesores: estancia.numeroProfesores ?? 0,
  };

  const estanciaBloque = (
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
              reservaDias: estancia.reservaDias,
              reservaCreadaEn: estancia.reservaCreadaEn
                ? estancia.reservaCreadaEn.toISOString()
                : null,
              notas: estancia.notas,
            }}
            presupuesto={presupuesto}
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
            presupuestoValidado={presupuestoValidado}
            presupuestoExiste={Boolean(estancia.presupuesto)}
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

  const participantesBloque = (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <Participantes
        estanciaId={estancia.id}
        participantes={participantes}
        habitaciones={habitacionesDisponibles}
        estanciaFechaInicio={toDateInput(estancia.fechaInicio) || null}
        necesarios={necesarios}
        totalLibres={totalLibres}
      />
    </div>
  );

  return { estancia: estanciaBloque, participantes: participantesBloque };
}
