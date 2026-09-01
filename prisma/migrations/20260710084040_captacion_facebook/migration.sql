-- AlterEnum
ALTER TYPE "TipoInteraccion" ADD VALUE 'CAPTACION_FACEBOOK';

-- AlterTable
ALTER TABLE "Interaccion" ADD COLUMN     "capturaBase64" TEXT,
ADD COLUMN     "mensajeContacto" TEXT,
ADD COLUMN     "perfilUrl" TEXT;
