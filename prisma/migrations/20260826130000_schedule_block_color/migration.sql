-- Optional user-picked chip color for a schedule block. Stores the
-- catalog key (see src/lib/event-catalog.ts); UI resolves to Tailwind
-- classes. Null means "use the default color for this event kind."
ALTER TABLE "public"."schedule_blocks" ADD COLUMN "color" text;
