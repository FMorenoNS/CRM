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

// Países disponibles en el selector del formulario de centro.
export const PAIS_OPTIONS = [
  "Alemania",
  "Andorra",
  "Arabia Saudí",
  "Argelia",
  "Argentina",
  "Australia",
  "Austria",
  "Bélgica",
  "Bolivia",
  "Bosnia y Herzegovina",
  "Brasil",
  "Bulgaria",
  "Canadá",
  "Chequia",
  "Chile",
  "China",
  "Chipre",
  "Colombia",
  "Corea del Sur",
  "Costa Rica",
  "Croacia",
  "Dinamarca",
  "Ecuador",
  "Egipto",
  "Emiratos Árabes Unidos",
  "Eslovaquia",
  "Eslovenia",
  "España",
  "Estados Unidos",
  "Estonia",
  "Filipinas",
  "Finlandia",
  "Francia",
  "Georgia",
  "Grecia",
  "Guatemala",
  "Hungría",
  "India",
  "Indonesia",
  "Irlanda",
  "Islandia",
  "Israel",
  "Italia",
  "Japón",
  "Letonia",
  "Líbano",
  "Liechtenstein",
  "Lituania",
  "Luxemburgo",
  "Malta",
  "Marruecos",
  "México",
  "Moldavia",
  "Mónaco",
  "Montenegro",
  "Noruega",
  "Nueva Zelanda",
  "Países Bajos",
  "Panamá",
  "Paraguay",
  "Perú",
  "Polonia",
  "Portugal",
  "Reino Unido",
  "República Dominicana",
  "Rumanía",
  "Rusia",
  "Serbia",
  "Singapur",
  "Sudáfrica",
  "Suecia",
  "Suiza",
  "Tailandia",
  "Túnez",
  "Turquía",
  "Ucrania",
  "Uruguay",
  "Venezuela",
  "Vietnam",
  "Macedonia del Norte",
  "Otro",
] as const;

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

export const TIPO_CLIENTE_LABELS: Record<string, string> = {
  CENTRO: "Centro",
  PERSONA: "Persona",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MARKETING: "Marketing",
  DIRECCION: "Dirección",
};
