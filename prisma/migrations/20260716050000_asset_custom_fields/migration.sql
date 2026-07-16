-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN     "fieldSchema" JSONB;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "customFields" JSONB;
