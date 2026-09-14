-- AlterTable
ALTER TABLE "Habitacion" ADD COLUMN     "centroNovaschool" "CentroNovaschool" NOT NULL DEFAULT 'MEDINA_ELVIRA';

-- CreateIndex
CREATE UNIQUE INDEX "Habitacion_centroNovaschool_nombre_key" ON "Habitacion"("centroNovaschool", "nombre");

