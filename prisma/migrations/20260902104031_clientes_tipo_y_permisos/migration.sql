-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('CENTRO', 'PERSONA');

-- AlterTable
ALTER TABLE "Centro" ADD COLUMN     "tipo" "TipoCliente" NOT NULL DEFAULT 'CENTRO';

-- CreateTable
CREATE TABLE "_UsuarioCentros" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UsuarioCentros_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UsuarioCentros_B_index" ON "_UsuarioCentros"("B");

-- AddForeignKey
ALTER TABLE "_UsuarioCentros" ADD CONSTRAINT "_UsuarioCentros_A_fkey" FOREIGN KEY ("A") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UsuarioCentros" ADD CONSTRAINT "_UsuarioCentros_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
