-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('TICKET_CREATED', 'STATUS_CHANGED', 'PRIORITY_ESCALATED', 'IDLE_TIME_EXCEEDED');

-- CreateEnum
CREATE TYPE "AutomationAction" AS ENUM ('ASSIGN_TECHNICIAN', 'SEND_EMAIL_NOTIFICATION', 'CHANGE_STATUS', 'CHANGE_PRIORITY');

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "responseTargetMinutes" INTEGER NOT NULL,
    "resolutionTargetMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "AutomationTrigger" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditionBoardId" TEXT,
    "conditionPriority" "TicketPriority",
    "conditionClientId" TEXT,
    "actionType" "AutomationAction" NOT NULL,
    "actionAssigneeId" TEXT,
    "actionStatus" "TicketStatus",
    "actionPriority" "TicketPriority",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_priority_key" ON "SlaPolicy"("priority");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_isActive_idx" ON "AutomationRule"("triggerType", "isActive");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_conditionBoardId_fkey" FOREIGN KEY ("conditionBoardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_conditionClientId_fkey" FOREIGN KEY ("conditionClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_actionAssigneeId_fkey" FOREIGN KEY ("actionAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
