-- CreateEnum
CREATE TYPE "OrgMode" AS ENUM ('MSP', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "orgMode" "OrgMode" NOT NULL DEFAULT 'MSP';
