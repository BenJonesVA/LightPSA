-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "totalWaitMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waitingSince" TIMESTAMPTZ(3);

-- Best-effort backfill: tickets already sitting in WAITING_ON_CLIENT start
-- their pause clock from this migration forward rather than losing that
-- state entirely. This doesn't recover time already spent waiting before
-- this migration ran.
UPDATE "Ticket" SET "waitingSince" = "updatedAt" WHERE "status" = 'WAITING_ON_CLIENT';
