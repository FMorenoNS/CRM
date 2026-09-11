-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN     "centrosNovaschool" "CentroNovaschool"[],
ADD COLUMN     "validadoEn" TIMESTAMP(3),
ADD COLUMN     "validadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "Presupuesto_validadoPorId_idx" ON "Presupuesto"("validadoPorId");

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
