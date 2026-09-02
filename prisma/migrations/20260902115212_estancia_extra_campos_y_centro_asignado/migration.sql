-- CreateEnum
CREATE TYPE "TipoProyecto" AS ENUM ('ERASMUS', 'PRIVADO');

-- CreateEnum
CREATE TYPE "CentroNovaschool" AS ENUM ('OPENWORLD', 'MEDINA_ELVIRA');

-- AlterTable
ALTER TABLE "Estancia" ADD COLUMN     "numeroAlumnos" INTEGER,
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "tipoProyecto" "TipoProyecto";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "centroAsignado" "CentroNovaschool";
