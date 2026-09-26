-- CreateEnum
CREATE TYPE "ProjectState" AS ENUM ('DRAFT', 'ANALYSIS_REVIEW', 'APPROVED', 'PLANNED');

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('LMDP', 'SPRUCE_PANEL', 'BIRCH_PANEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ValueSource" AS ENUM ('DRAWING', 'OWNER_INPUT', 'DERIVED', 'AI_PROPOSAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Store" AS ENUM ('SENUKAI', 'ERMITAZAS');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PANEL', 'EDGE_BANDING', 'HARDWARE', 'FASTENER', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "SellingUnit" AS ENUM ('PIECE', 'PACK', 'LINEAR_METER', 'SQUARE_METER', 'LITER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "ProjectState" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "thicknessMm" DECIMAL(8,1) NOT NULL,
    "species" TEXT,
    "decor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementsRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementsRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "externalId" TEXT NOT NULL,
    "variantId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "dimensionsMm" JSONB,
    "material" "MaterialKind",
    "species" TEXT,
    "decor" TEXT,
    "sellingUnit" "SellingUnit" NOT NULL,
    "packContents" DECIMAL(65,30),

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductObservation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCents" INTEGER,
    "conditionalCents" INTEGER,
    "priceCondition" TEXT,
    "availability" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceData" JSONB NOT NULL,

    CONSTRAINT "ProductObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePlan" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "settings" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_currentRevisionId_key" ON "Project"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialGroup_projectId_name_key" ON "MaterialGroup"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Drawing_objectKey_key" ON "Drawing"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementsRevision_projectId_revision_key" ON "RequirementsRevision"("projectId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_store_externalId_variantId_key" ON "StoreProduct"("store", "externalId", "variantId");

-- CreateIndex
CREATE INDEX "ProductObservation_productId_observedAt_idx" ON "ProductObservation"("productId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "RequirementsRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialGroup" ADD CONSTRAINT "MaterialGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementsRevision" ADD CONSTRAINT "RequirementsRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductObservation" ADD CONSTRAINT "ProductObservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlan" ADD CONSTRAINT "PurchasePlan_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RequirementsRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
