-- CreateTable
CREATE TABLE "Habitacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participante" (
    "id" TEXT NOT NULL,
    "estanciaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "TipoParticipante" NOT NULL,
    "habitacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Habitacion_activa_idx" ON "Habitacion"("activa");

-- CreateIndex
CREATE INDEX "Participante_estanciaId_idx" ON "Participante"("estanciaId");

-- CreateIndex
CREATE INDEX "Participante_habitacionId_idx" ON "Participante"("habitacionId");

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_estanciaId_fkey" FOREIGN KEY ("estanciaId") REFERENCES "Estancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participante" ADD CONSTRAINT "Participante_habitacionId_fkey" FOREIGN KEY ("habitacionId") REFERENCES "Habitacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
