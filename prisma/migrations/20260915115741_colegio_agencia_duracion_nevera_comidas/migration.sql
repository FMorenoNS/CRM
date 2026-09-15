-- CreateEnum
CREATE TYPE "DuracionEstancia" AS ENUM ('CORTA', 'LARGA');

-- AlterTable
ALTER TABLE "Centro" ADD COLUMN     "esAgencia" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Estancia" ADD COLUMN     "diasManual" INTEGER,
ADD COLUMN     "duracion" "DuracionEstancia",
ADD COLUMN     "duracionManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nochesManual" INTEGER;

-- AlterTable
ALTER TABLE "Habitacion" ADD COLUMN     "tieneNevera" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Participante" ADD COLUMN     "almuerzo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cena" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "desayuno" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Presupuesto" ALTER COLUMN "numMonitores" SET DEFAULT 1;

