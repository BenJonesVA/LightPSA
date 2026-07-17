-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('MANAGE_BOARDS', 'MANAGE_CLIENTS', 'MANAGE_ASSETS', 'MANAGE_CATEGORIES', 'MANAGE_AUTOMATION', 'MANAGE_SLA', 'MANAGE_CANNED_RESPONSES', 'MANAGE_BRANDING', 'MANAGE_USERS', 'MANAGE_BILLING', 'VIEW_REPORTS');

-- CreateTable
CREATE TABLE "PermissionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "UserPermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_name_key" ON "PermissionGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionGroup_userId_groupId_key" ON "UserPermissionGroup"("userId", "groupId");

-- CreateIndex
CREATE INDEX "UserPermissionGroup_groupId_idx" ON "UserPermissionGroup"("groupId");

-- AddForeignKey
ALTER TABLE "UserPermissionGroup" ADD CONSTRAINT "UserPermissionGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionGroup" ADD CONSTRAINT "UserPermissionGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
