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
  // Solo aplica cuando tipo=CENTRO: distingue un colegio directo de una
  // agencia que representa a varios.
  esAgencia: z.boolean().optional().default(false),
  pais: textoCorto().optional().default(""),
  ciudad: textoCorto().optional().nullable().or(z.literal("")),
  vat: textoCorto(60).optional().nullable().or(z.literal("")),
  direccion: textoCorto(300).optional().nullable().or(z.literal("")),
  canalOrigen: textoCorto().min(1).default("Facebook"),
  notas: z.string().trim().max(LARGO, "El texto es demasiado largo (máx. 5.000 caracteres).").optional().nullable(),
});

// Datos fiscales de cada centro propio de Novaschool (para el PDF del
// presupuesto). Todo opcional: se rellena poco a poco desde Usuarios.
export const centroNovaschoolInfoSchema = z.object({
  centro: z.enum(["OPENWORLD", "MEDINA_ELVIRA", "ANORETA"]),
  razonSocial: textoCorto(200).optional().nullable().or(z.literal("")),
  cif: textoCorto(40).optional().nullable().or(z.literal("")),
  oid: textoCorto(40).optional().nullable().or(z.literal("")),
  direccion: textoCorto(300).optional().nullable().or(z.literal("")),
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
  numeroProfesores: numeroOpcional,
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
  numeroProfesores: numeroOpcional,
  edadGrupo: textoCorto(60).optional().nullable(),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  estado: z.enum(ESTADOS).optional(),
  presupuestoImporte: numeroOpcional,
  // Días que dura la reserva provisional de plaza una vez enviado el
  // presupuesto (el momento de envío lo pone el sistema, no este campo).
  reservaDias: z
    .union([z.number().int().min(1).max(365), z.string().max(10)])
    .optional()
    .nullable(),
  // Duración corta/larga (más de 3 meses). Si duracionManual no es true, el
  // servidor la recalcula solo a partir de los días y este valor se ignora.
  duracion: z.enum(["CORTA", "LARGA"]).optional().nullable().or(z.literal("")),
  duracionManual: z.boolean().optional(),
  // Días y noches a mano, para cuando no hay fecha de entrada ni de salida.
  diasManual: numeroOpcional,
  nochesManual: numeroOpcional,
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
  // Obligatorio al crear el perfil: todo usuario pertenece a un centro de
  // Novaschool (informativo, pero necesario para saber quién puede validar
  // los presupuestos de cada centro).
  centroAsignado: z.enum(["OPENWORLD", "MEDINA_ELVIRA", "ANORETA"], {
    error: "Selecciona el centro al que pertenece este usuario.",
  }),
});

export const habitacionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  capacidad: z.coerce
    .number()
    .int("La capacidad debe ser un número entero.")
    .min(1, "La capacidad debe ser al menos 1.")
    .max(50, "La capacidad parece demasiado alta."),
  activa: z.boolean().optional(),
  // Las habitaciones de profesorado son las que tienen nevera.
  tieneNevera: z.boolean().optional(),
});

export const updateHabitacionSchema = habitacionSchema.partial();

export const participanteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  rol: z.enum(["ALUMNOS", "PROFESORES"]),
  habitacionId: z.string().trim().optional().nullable().or(z.literal("")),
  // Confirmación explícita del usuario para saltarse el aviso de "alumnos y
  // profesores no comparten habitación" en un caso concreto. La capacidad
  // física de la habitación se sigue comprobando siempre, esto no la salta.
  forzarMezcla: z.boolean().optional(),
  // Datos sensibles: opcionales siempre (se rellenan después de crear el
  // participante, no en el alta rápida).
  fechaNacimiento: z.string().trim().optional().nullable().or(z.literal("")),
  alergias: z.string().trim().optional().nullable(),
  contactoEmergenciaNombre: z.string().trim().optional().nullable(),
  contactoEmergenciaTelefono: z.string().trim().optional().nullable(),
  autorizacionRecibida: z.boolean().optional(),
  seguroRecibido: z.boolean().optional(),
  // Solo informativo para la residencia (cocina): no afecta al cálculo del
  // presupuesto.
  desayuno: z.boolean().optional(),
  almuerzo: z.boolean().optional(),
  cena: z.boolean().optional(),
});

export const updateParticipanteSchema = participanteSchema.partial();

// Presupuesto: el detalle que llega de la ventana de cálculo.
//
// Los importes NO se aceptan del navegador. Aquí solo se comprueba que lo
// que llega tiene forma y está en rangos razonables; los totales los vuelve
// a calcular el servidor con calcularPresupuesto() (src/lib/precios.ts).
export const presupuestoLineaSchema = z.object({
  tipo: z.enum(["CONCEPTO", "AUTOBUS"]),
  codigo: z.string().trim().min(1).max(60),
  nombre: z.string().trim().min(1).max(120),
  // El precio se puede ajustar a mano, porque un presupuesto se negocia. El
  // tope no es una regla de negocio, solo evita un valor absurdo por un
  // dedazo.
  precioUnitario: z.number().min(0).max(1_000_000),
  dias: z.number().int().min(0).max(400),
  cantidad: z.number().int().min(0).max(2000),
});

export const presupuestoSchema = z.object({
  numAlumnos: z.number().int().min(0).max(2000),
  numProfesores: z.number().int().min(0).max(2000),
  numMonitores: z.number().int().min(0).max(2000),
  // Fracciones, no porcentajes: 0,2 es el 20 %.
  margenPct: z.number().min(0).max(1),
  ivaPct: z.number().min(0).max(1),
  notas: z.string().trim().max(5000).optional().nullable(),
  lineas: z.array(presupuestoLineaSchema).max(200),
  // Centro(s) de Novaschool que acogen al grupo. Determina quién puede
  // darle el visto bueno al presupuesto antes de enviarlo.
  centrosNovaschool: z
    .array(z.enum(["OPENWORLD", "MEDINA_ELVIRA", "ANORETA"]))
    .max(3)
    .optional()
    .default([]),
});

export const ESTADO_VALUES = ESTADOS;
