-- DropIndex
DROP INDEX "messages_search_gin";

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "materialRollId" UUID NOT NULL,
    "jobId" UUID,
    "kind" TEXT NOT NULL DEFAULT 'deduct',
    "lengthYd" DECIMAL(8,2) NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "performedByUserId" UUID,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceName" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "manufacturerWarranty" TEXT,
    "filmDetails" TEXT,
    "installer" TEXT,
    "installDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "documentFileId" UUID,
    "filedByCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftercare_templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "serviceCategoryId" UUID,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aftercare_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "provider" TEXT NOT NULL DEFAULT 'google',
    "url" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_transactions_organizationId_performedAt_idx" ON "inventory_transactions"("organizationId", "performedAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_materialRollId_performedAt_idx" ON "inventory_transactions"("materialRollId", "performedAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_jobId_idx" ON "inventory_transactions"("jobId");

-- CreateIndex
CREATE INDEX "warranties_organizationId_expiresAt_idx" ON "warranties"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "warranties_customerId_idx" ON "warranties"("customerId");

-- CreateIndex
CREATE INDEX "warranties_jobId_idx" ON "warranties"("jobId");

-- CreateIndex
CREATE INDEX "aftercare_templates_organizationId_idx" ON "aftercare_templates"("organizationId");

-- CreateIndex
CREATE INDEX "aftercare_templates_serviceCategoryId_idx" ON "aftercare_templates"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "review_requests_organizationId_idx" ON "review_requests"("organizationId");

-- CreateIndex
CREATE INDEX "review_requests_customerId_idx" ON "review_requests"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_jobId_provider_key" ON "review_requests"("jobId", "provider");

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_materialRollId_fkey" FOREIGN KEY ("materialRollId") REFERENCES "material_rolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_templates" ADD CONSTRAINT "aftercare_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_templates" ADD CONSTRAINT "aftercare_templates_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
