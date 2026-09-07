-- AlterTable
ALTER TABLE "Participante" ADD COLUMN     "alergias" TEXT,
ADD COLUMN     "autorizacionRecibida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactoEmergenciaNombre" TEXT,
ADD COLUMN     "contactoEmergenciaTelefono" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "seguroRecibido" BOOLEAN NOT NULL DEFAULT false;
