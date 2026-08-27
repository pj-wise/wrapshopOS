-- The DROP INDEX statements Prisma auto-generated here targeted the FTS +
-- trigram indexes managed by prisma/sql/fts-phase3.sql (a separate migration).
-- They were removed so the shadow DB can replay this migration cleanly.
-- The real DB retains those indexes (re-applied by fts-phase3.sql after this).

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
