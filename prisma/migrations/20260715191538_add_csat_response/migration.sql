-- CreateTable
CREATE TABLE "CsatResponse" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "respondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CsatResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CsatResponse_ticketId_key" ON "CsatResponse"("ticketId");

-- AddForeignKey
ALTER TABLE "CsatResponse" ADD CONSTRAINT "CsatResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
