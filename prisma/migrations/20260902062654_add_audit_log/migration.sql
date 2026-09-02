-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_centroId_createdAt_idx" ON "AuditLog"("centroId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
