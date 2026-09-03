import { z } from "zod";

/**
 * Reglas de validación de todo lo que entra al CRM desde fuera.
 *
 * Además de comprobar el formato, TODOS los campos de texto llevan un tope
 * de longitud. Sin ese tope, cualquiera podría guardar megas de texto en el
 * campo "notas" y llenar la base de datos, o hacer lento el CRM para todos.
 */

// Topes por tipo de campo (en caracteres).
const CORTO = 120; // nombres, ciudades, cargos, teléfonos...
const MEDIO = 400; // resúmenes, títulos de programa
const LARGO = 5000; // notas y textos libres
const URL_MAX = 2000;
const EMAIL_MAX = 320;

const textoCorto = (max = CORTO) =>
  z.string().trim().max(max, `Este campo no puede pasar de ${max} caracteres.`);
const emailOpcional = (mensaje = "Email inválido.") =>
  z.string().trim().max(EMAIL_MAX).email(mensaje).optional().nullable().or(z.literal(""));
const urlOpcional = (mensaje: string) =>
  z.string().trim().max(URL_MAX).url(mensaje).optional().nullable().or(z.literal(""));
// Números que llegan como texto desde los formularios: se acotan para que no
// entre un valor absurdo (ni un texto larguísimo disfrazado de número).
const numeroOpcional = z
  .union([z.number().finite(), z.string().max(20)])
  .optional()
  .nullable();
// Fechas en formato de texto (YYYY-MM-DD o ISO).
const fechaOpcional = z.string().trim().max(40).optional().nullable();

export const loginSchema = z.object({
  email: z.string().trim().max(EMAIL_MAX, "Email demasiado largo.").email("Email inválido."),
  // El tope de 200 evita que alguien envíe una "contraseña" de megas para
  // hacer trabajar al servidor calculando hashes enormes.
  password: z.string().min(1, "La contraseña es obligatoria.").max(200),
});

export const centroSchema = z.object({
  nombre: textoCorto(200).optional().default(""),
  tipo: z.enum(["CENTRO", "PERSONA"]).optional().default("CENTRO"),
  pais: textoCorto().optional().default(""),
  ciudad: textoCorto().optional().nullable().or(z.literal("")),
  canalOrigen: textoCorto().min(1).default("Facebook"),
  notas: z.string().trim().max(LARGO, "El texto es demasiado largo (máx. 5.000 caracteres).").optional().nullable(),
});

// Creación: además del centro, permite un contacto principal opcional, la
// primera estancia (siempre se crea, con estado INTERESADO) y un flag
// `force` para crear aunque se detecte un posible duplicado. Ningún campo
// es obligatorio.
export const createCentroSchema = centroSchema.extend({
  contactoNombre: textoCorto().optional().nullable(),
  contactoCargo: textoCorto().optional().nullable(),
  contactoEmail: emailOpcional("Email de contacto inválido."),
  contactoTelefono: textoCorto(40).optional().nullable(),
  tipoPrograma: textoCorto(MEDIO).optional().nullable().or(z.literal("")),
  tipoProyecto: z.enum(["ERASMUS", "PRIVADO"]).optional().nullable().or(z.literal("")),
  tipoParticipante: z.enum(["ALUMNOS", "PROFESORES"]).optional(),
  centroReceptor: textoCorto().optional().nullable().or(z.literal("")),
  provincia: textoCorto().optional().nullable(),
  numeroAlumnos: numeroOpcional,
  edadGrupo: textoCorto(60).optional().nullable(),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  presupuestoImporte: numeroOpcional,
  estanciaNotas: z.string().trim().max(LARGO, "El texto es demasiado largo (máx. 5.000 caracteres).").optional().nullable(),
  grupoUrl: urlOpcional("La URL del grupo no es válida."),
  force: z.boolean().optional(),
});

export const contactoSchema = z.object({
  nombre: textoCorto().min(1, "El nombre del contacto es obligatorio."),
  telefono: textoCorto(40).optional().nullable(),
  email: emailOpcional(),
  cargo: textoCorto().optional().nullable(),
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
  tipoPrograma: textoCorto(MEDIO).min(1, "El tipo de programa es obligatorio."),
  tipoProyecto: z.enum(["ERASMUS", "PRIVADO"]).optional().nullable().or(z.literal("")),
  tipoParticipante: z.enum(["ALUMNOS", "PROFESORES"]),
  centroReceptor: textoCorto().min(1).default("Granada"),
  provincia: textoCorto().optional().nullable(),
  numeroAlumnos: numeroOpcional,
  edadGrupo: textoCorto(60).optional().nullable(),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  estado: z.enum(ESTADOS).optional(),
  presupuestoImporte: numeroOpcional,
  notas: z.string().trim().max(LARGO, "El texto es demasiado largo (máx. 5.000 caracteres).").optional().nullable(),
});

export const estanciaSchema = estanciaBaseSchema.extend({
  // Los identificadores del CRM son cuid: siempre cortos. Acotarlos evita
  // que se use este campo como vía para colar textos enormes.
  centroId: z.string().trim().min(1, "El centro es obligatorio.").max(64),
});

export const updateEstanciaSchema = estanciaBaseSchema;

export const estadoSchema = z.object({
  estado: z.enum(ESTADOS),
});

export const interaccionSchema = z.object({
  tipo: z.enum(["LLAMADA", "EMAIL", "WHATSAPP", "NOTA"]),
  resumen: z.string().trim().min(1, "El resumen es obligatorio.").max(LARGO),
  fecha: fechaOpcional,
});

/**
 * La captura de pantalla de la captación llega incrustada como "data URL".
 * Se comprueba que sea realmente una imagen: si se aceptase cualquier
 * `data:`, alguien podría guardar ahí un `data:text/html` con código dentro
 * y convertir la captura en una trampa para quien la abriera.
 */
const CAPTURA_MAX_CARACTERES = 5_000_000; // ~3,5 MB de imagen real
const capturaImagen = z
  .string()
  .max(CAPTURA_MAX_CARACTERES, "La captura es demasiado grande (máx. ~3,5 MB).")
  .refine(
    (v) => v === "" || /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(v),
    "La captura debe ser una imagen (PNG, JPEG, WEBP o GIF)."
  );

// Captación desde Facebook: primera interacción de una estancia.
export const captacionSchema = z.object({
  grupoUrl: urlOpcional("La URL del grupo no es válida."),
  perfilUrl: urlOpcional("La URL del perfil no es válida."),
  mensajeContacto: z.string().trim().max(LARGO, "El texto es demasiado largo (máx. 5.000 caracteres).").optional().nullable(),
  capturaBase64: capturaImagen.optional().nullable().or(z.literal("")),
});

export const userSchema = z.object({
  nombre: textoCorto().min(1, "El nombre es obligatorio."),
  email: z.string().trim().max(EMAIL_MAX).email("Email inválido."),
  // El mínimo real y las reglas de fortaleza se comprueban en el servidor
  // con validarFortaleza() (src/lib/passwords.ts).
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres.")
    .max(200),
  role: z.enum(["ADMIN", "MARKETING", "DIRECCION"]),
  centroIds: z.array(z.string().max(64)).max(500).optional(),
  centroAsignado: z
    .enum(["OPENWORLD", "MEDINA_ELVIRA"])
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const ESTADO_VALUES = ESTADOS;
