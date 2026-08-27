import { JobCalendar } from "@/modules/production/job-calendar";
import { PendingSchedulingList } from "@/modules/production/pending-scheduling-list";

export default function Page() {
  return (
    <div className="mx-auto max-w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag jobs to reschedule. Toggle day / week / month above the grid.
        </p>
      </div>
      <PendingSchedulingList />
      <JobCalendar />
    </div>
  );
}
