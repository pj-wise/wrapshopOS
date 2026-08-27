export const metadata = {
  title: "Offline · WrapShop OS",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
          W
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Cached pages will keep working. Anything you do while offline is queued
          and syncs when your connection returns. Photo uploads, checklist
          toggles, notes, and time punches are safe to keep doing.
        </p>
        <p className="mt-6 text-xs text-neutral-500">
          Financial actions like quote approvals, invoice creation, and payment
          entry are blocked until you&apos;re back online.
        </p>
      </div>
    </div>
  );
}
