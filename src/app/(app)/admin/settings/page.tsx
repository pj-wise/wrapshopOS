import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ReviewSettings } from "@/modules/reports/review-settings";

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shop settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization-wide preferences and workflow defaults.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Catalog
        </div>
        <ul className="space-y-2 text-sm">
          <li>
            <Link
              href="/admin/settings/services"
              className="inline-flex items-center gap-1 hover:underline"
            >
              Services <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/settings/workflow"
              className="inline-flex items-center gap-1 hover:underline"
            >
              Job workflow <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li className="text-muted-foreground">
            Aftercare templates + warranty defaults land in the follow-up
            iteration; the job-delivered aftermath already runs with sensible
            defaults if templates are absent.
          </li>
        </ul>
      </div>

      <ReviewSettings />
    </div>
  );
}
