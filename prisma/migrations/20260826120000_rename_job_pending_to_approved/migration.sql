-- Rename job.status "pending" → "approved" to match the new stage catalog.
-- The `pending` value was semantically "quote approved but no deposit yet",
-- which is what "approved" means in the customer-facing timeline. This is a
-- pure data migration (no schema change) since jobs.status is a plain text
-- column.
UPDATE public.jobs SET status = 'approved' WHERE status = 'pending';
