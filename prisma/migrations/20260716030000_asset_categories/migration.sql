-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetCategory_parentId_idx" ON "AssetCategory"("parentId");

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed one category per existing AssetType enum value, id derived from the
-- lowercased enum value so the backfill below can join on it generically.
INSERT INTO "AssetCategory" ("id", "name") VALUES
    ('assetcat_workstation', 'Workstation'),
    ('assetcat_laptop', 'Laptop'),
    ('assetcat_server', 'Server'),
    ('assetcat_network_device', 'Network Device'),
    ('assetcat_printer', 'Printer'),
    ('assetcat_mobile_device', 'Mobile Device'),
    ('assetcat_other', 'Other');

-- AlterTable: add nullable first so existing rows can be backfilled before
-- the NOT NULL constraint is applied (this table already has live data).
ALTER TABLE "Asset" ADD COLUMN "categoryId" TEXT;

UPDATE "Asset" SET "categoryId" = 'assetcat_' || lower("type"::text);

ALTER TABLE "Asset" ALTER COLUMN "categoryId" SET NOT NULL;

-- DropColumn
ALTER TABLE "Asset" DROP COLUMN "type";

-- DropEnum
DROP TYPE "AssetType";

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
