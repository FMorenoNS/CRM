-- AlterTable
ALTER TABLE "Participante" ADD COLUMN     "celiaco" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intoleranteLactosa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vegetariano" BOOLEAN NOT NULL DEFAULT false;

