-- CreateEnum
CREATE TYPE "TipoLineaPresupuesto" AS ENUM ('CONCEPTO', 'AUTOBUS');

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" TEXT NOT NULL,
    "estanciaId" TEXT NOT NULL,
    "numAlumnos" INTEGER NOT NULL DEFAULT 0,
    "numProfesores" INTEGER NOT NULL DEFAULT 0,
    "numMonitores" INTEGER NOT NULL DEFAULT 0,
    "margenPct" DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    "ivaPct" DECIMAL(6,4) NOT NULL DEFAULT 0.1000,
    "totalNeto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "margenImporte" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ivaImporte" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pvpPorPersona" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "actualizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoLinea" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "tipo" "TipoLineaPresupuesto" NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "dias" INTEGER NOT NULL DEFAULT 1,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PresupuestoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_estanciaId_key" ON "Presupuesto"("estanciaId");

-- CreateIndex
CREATE INDEX "Presupuesto_actualizadoPorId_idx" ON "Presupuesto"("actualizadoPorId");

-- CreateIndex
CREATE INDEX "PresupuestoLinea_presupuestoId_idx" ON "PresupuestoLinea"("presupuestoId");

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_estanciaId_fkey" FOREIGN KEY ("estanciaId") REFERENCES "Estancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoLinea" ADD CONSTRAINT "PresupuestoLinea_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
