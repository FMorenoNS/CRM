export const ESTADO_LABELS: Record<string, string> = {
  INTERESADO: "Interesado",
  CONTACTADO: "Contactado",
  EN_CONVERSACION: "En conversación",
  PRESUPUESTO_ENVIADO: "Presupuesto enviado",
  PRESUPUESTO_CONFIRMADO: "Presupuesto confirmado",
  CONTRATO_FIRMADO: "Contrato firmado",
  ALOJADO: "Alojado",
  FINALIZADO: "Finalizado",
  PERDIDO: "Perdido",
};

// Orden del pipeline (excluye PERDIDO, que es una salida lateral)
export const PIPELINE_ESTADOS = [
  "INTERESADO",
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
  "CONTRATO_FIRMADO",
  "ALOJADO",
  "FINALIZADO",
] as const;

export const TODOS_ESTADOS = [...PIPELINE_ESTADOS, "PERDIDO"] as const;

export const PARTICIPANTE_LABELS: Record<string, string> = {
  ALUMNOS: "Alumnos",
  PROFESORES: "Profesores",
};

// Tipos de programa disponibles (desplegable en la estancia).
export const PROGRAMA_OPTIONS = [
  "Movilidad escolar",
  "Acogida",
  "Open Work Academy",
  "Job shadowing",
] as const;

// Canales por los que puede llegar un centro (origen del lead).
export const CANAL_OPTIONS = ["Facebook", "Email", "Teléfono", "Otro"] as const;

export const INTERACCION_LABELS: Record<string, string> = {
  CAPTACION_FACEBOOK: "Captación (Facebook)",
  LLAMADA: "Llamada",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  NOTA: "Nota",
};

export const DOCUMENTO_LABELS: Record<string, string> = {
  PRESUPUESTO: "Presupuesto",
  CONTRATO: "Contrato",
};
