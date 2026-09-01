-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MARKETING', 'DIRECCION');

-- CreateEnum
CREATE TYPE "TipoParticipante" AS ENUM ('ALUMNOS', 'PROFESORES');

-- CreateEnum
CREATE TYPE "EstadoEstancia" AS ENUM ('INTERESADO', 'CONTACTADO', 'EN_CONVERSACION', 'PRESUPUESTO_ENVIADO', 'PRESUPUESTO_CONFIRMADO', 'CONTRATO_FIRMADO', 'ALOJADO', 'FINALIZADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoInteraccion" AS ENUM ('LLAMADA', 'EMAIL', 'WHATSAPP', 'NOTA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('PRESUPUESTO', 'CONTRATO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Centro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Centro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "cargo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estancia" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "tipoPrograma" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "edadGrupo" TEXT,
    "tipoParticipante" "TipoParticipante" NOT NULL,
    "centroReceptor" TEXT NOT NULL DEFAULT 'Granada',
    "estado" "EstadoEstancia" NOT NULL DEFAULT 'INTERESADO',
    "presupuestoImporte" DECIMAL(10,2),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaccion" (
    "id" TEXT NOT NULL,
    "estanciaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoInteraccion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoEnviado" (
    "id" TEXT NOT NULL,
    "estanciaId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "enviadoPorId" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exito" BOOLEAN NOT NULL DEFAULT true,
    "detalle" TEXT,

    CONSTRAINT "DocumentoEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Centro_pais_idx" ON "Centro"("pais");

-- CreateIndex
CREATE INDEX "Centro_nombre_idx" ON "Centro"("nombre");

-- CreateIndex
CREATE INDEX "Contacto_centroId_idx" ON "Contacto"("centroId");

-- CreateIndex
CREATE INDEX "Estancia_centroId_idx" ON "Estancia"("centroId");

-- CreateIndex
CREATE INDEX "Estancia_estado_idx" ON "Estancia"("estado");

-- CreateIndex
CREATE INDEX "Interaccion_estanciaId_fecha_idx" ON "Interaccion"("estanciaId", "fecha");

-- CreateIndex
CREATE INDEX "DocumentoEnviado_estanciaId_idx" ON "DocumentoEnviado"("estanciaId");

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estancia" ADD CONSTRAINT "Estancia_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_estanciaId_fkey" FOREIGN KEY ("estanciaId") REFERENCES "Estancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEnviado" ADD CONSTRAINT "DocumentoEnviado_estanciaId_fkey" FOREIGN KEY ("estanciaId") REFERENCES "Estancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEnviado" ADD CONSTRAINT "DocumentoEnviado_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
