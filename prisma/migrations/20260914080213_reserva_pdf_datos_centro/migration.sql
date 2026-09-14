-- AlterTable
ALTER TABLE "Centro" ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "vat" TEXT;

-- AlterTable
ALTER TABLE "Estancia" ADD COLUMN     "reservaCreadaEn" TIMESTAMP(3),
ADD COLUMN     "reservaDias" INTEGER DEFAULT 15;

-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN     "numero" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "CentroNovaschoolInfo" (
    "centro" "CentroNovaschool" NOT NULL,
    "razonSocial" TEXT,
    "cif" TEXT,
    "oid" TEXT,
    "direccion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroNovaschoolInfo_pkey" PRIMARY KEY ("centro")
);

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_numero_key" ON "Presupuesto"("numero");

