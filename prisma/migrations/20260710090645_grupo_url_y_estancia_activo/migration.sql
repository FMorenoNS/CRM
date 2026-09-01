-- AlterTable
ALTER TABLE "Estancia" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Interaccion" ADD COLUMN     "grupoUrl" TEXT;
