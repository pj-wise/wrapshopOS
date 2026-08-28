-- CheckIn opt-out fields — audit trail for the "skip photos" flow. All
-- nullable / defaulted so existing rows keep working with no backfill.
ALTER TABLE "public"."check_ins"
  ADD COLUMN "optOutOfPhotos"             boolean NOT NULL DEFAULT false,
  ADD COLUMN "optOutReason"               text,
  ADD COLUMN "optOutAcknowledgedByUserId" uuid,
  ADD COLUMN "optOutAcknowledgedAt"       timestamptz;

-- Short-lived, one-time-use handoff token for the mobile check-in flow.
-- The desktop generates one, renders a QR, tech's phone consumes it.
CREATE TABLE "public"."mobile_check_in_tokens" (
  "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"  uuid NOT NULL,
  "jobId"           uuid NOT NULL,
  "token"           text NOT NULL,
  "expiresAt"       timestamptz NOT NULL,
  "consumedAt"      timestamptz,
  "completedAt"     timestamptz,
  "createdByUserId" uuid NOT NULL,
  "createdAt"       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_check_in_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_check_in_tokens_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mobile_check_in_tokens_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mobile_check_in_tokens_token_key"
  ON "public"."mobile_check_in_tokens" ("token");
CREATE INDEX "mobile_check_in_tokens_token_idx"
  ON "public"."mobile_check_in_tokens" ("token");
CREATE INDEX "mobile_check_in_tokens_orgJob_idx"
  ON "public"."mobile_check_in_tokens" ("organizationId", "jobId");
