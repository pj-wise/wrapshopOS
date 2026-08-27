import type { ReactNode } from "react";

export function EmptyPage({
  title,
  description,
  phase,
  action,
}: {
  title: string;
  description: string;
  phase: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
        {action}
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">
          Ships in <span className="font-medium text-neutral-700 dark:text-neutral-300">{phase}</span>.
        </p>
      </div>
    </div>
  );
}
