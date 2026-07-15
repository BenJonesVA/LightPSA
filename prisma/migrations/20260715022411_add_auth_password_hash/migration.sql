-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;
