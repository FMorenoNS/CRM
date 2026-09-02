import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const centroSchema = z.object({
  nombre: z.string().trim().optional().default(""),
  tipo: z.enum(["CENTRO", "PERSONA"]).optional().default("CENTRO"),
  pais: z.string().trim().optional().default(""),
  ciudad: z.string().trim().optional().nullable().or(z.literal("")),
  canalOrigen: z.string().trim().min(1).default("Facebook"),
  notas: z.string().trim().optional().nullable(),
});

// Creación: además del centro, permite un contacto principal opcional, la
// primera estancia (siempre se crea, con estado INTERESADO) y un flag
// `force` para crear aunque se detecte un posible duplicado. Ningún campo
// es obligatorio.
export const createCentroSchema = centroSchema.extend({
  contactoNombre: z.string().trim().optional().nullable(),
  contactoCargo: z.string().trim().optional().nullable(),
  contactoEmail: z
    .string()
    .trim()
    .email("Email de contacto inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
  contactoTelefono: z.string().trim().optional().nullable(),
  tipoPrograma: z.string().trim().optional().nullable().or(z.literal("")),
  tipoProyecto: z.enum(["ERASMUS", "PRIVADO"]).optional().nullable().or(z.literal("")),
  tipoParticipante: z.enum(["ALUMNOS", "PROFESORES"]).optional(),
  centroReceptor: z.string().trim().optional().nullable().or(z.literal("")),
  provincia: z.string().trim().optional().nullable(),
  numeroAlumnos: z.union([z.number(), z.string()]).optional().nullable(),
  edadGrupo: z.string().trim().optional().nullable(),
  fechaInicio: z.string().trim().optional().nullable(),
  fechaFin: z.string().trim().optional().nullable(),
  presupuestoImporte: z.union([z.number(), z.string()]).optional().nullable(),
  estanciaNotas: z.string().trim().optional().nullable(),
  grupoUrl: z
    .string()
    .trim()
    .url("La URL del grupo no es válida.")
    .optional()
    .nullable()
    .or(z.literal("")),
  force: z.boolean().optional(),
});

export const contactoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del contacto es obligatorio."),
  telefono: z.string().trim().optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Email inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
  cargo: z.string().trim().optional().nullable(),
});

const ESTADOS = [
  "INTERESADO",
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
  "CONTRATO_FIRMADO",
  "ALOJADO",
  "FINALIZADO",
  "PERDIDO",
] as const;

// Campos comunes a crear y editar una estancia. `centroId` NO va aquí: al
// crear es obligatorio (se añade en estanciaSchema) y al editar no aplica,
// porque el centro de una estancia ya existente no se puede cambiar (viene
// fijado por la URL).
const estanciaBaseSchema = z.object({
  tipoPrograma: z.string().trim().min(1, "El tipo de programa es obligatorio."),
  tipoProyecto: z.enum(["ERASMUS", "PRIVADO"]).optional().nullable().or(z.literal("")),
  tipoParticipante: z.enum(["ALUMNOS", "PROFESORES"]),
  centroReceptor: z.string().trim().min(1).default("Granada"),
  provincia: z.string().trim().optional().nullable(),
  numeroAlumnos: z.union([z.number(), z.string()]).optional().nullable(),
  edadGrupo: z.string().trim().optional().nullable(),
  fechaInicio: z.string().trim().optional().nullable(),
  fechaFin: z.string().trim().optional().nullable(),
  estado: z.enum(ESTADOS).optional(),
  presupuestoImporte: z.union([z.number(), z.string()]).optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export const estanciaSchema = estanciaBaseSchema.extend({
  centroId: z.string().min(1, "El centro es obligatorio."),
});

export const updateEstanciaSchema = estanciaBaseSchema;

export const estadoSchema = z.object({
  estado: z.enum(ESTADOS),
});

export const interaccionSchema = z.object({
  tipo: z.enum(["LLAMADA", "EMAIL", "WHATSAPP", "NOTA"]),
  resumen: z.string().trim().min(1, "El resumen es obligatorio."),
  fecha: z.string().trim().optional().nullable(),
});

// Captación desde Facebook: primera interacción de una estancia.
export const captacionSchema = z.object({
  grupoUrl: z
    .string()
    .trim()
    .url("La URL del grupo no es válida.")
    .optional()
    .or(z.literal("")),
  perfilUrl: z
    .string()
    .trim()
    .url("La URL del perfil no es válida.")
    .optional()
    .or(z.literal("")),
  mensajeContacto: z.string().trim().optional().nullable(),
  // Captura como data URL (data:image/...;base64,....). Se limita el tamaño.
  capturaBase64: z
    .string()
    .max(5_000_000, "La captura es demasiado grande (máx. ~3,5 MB).")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const userSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  role: z.enum(["ADMIN", "MARKETING", "DIRECCION"]),
  centroIds: z.array(z.string()).optional(),
  centroAsignado: z
    .enum(["OPENWORLD", "MEDINA_ELVIRA"])
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const ESTADO_VALUES = ESTADOS;
