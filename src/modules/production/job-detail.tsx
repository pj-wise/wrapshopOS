"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  FileText,
  Play,
  Square,
  Timer,
  User,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "./job-status-badge";
import { JOB_STAGES, PHOTO_PHASES, type PhotoPhaseKey, jobStageLabel } from "@/lib/production-catalog";
import { formatMoney } from "@/lib/money";
import { QuoteStatusBadge } from "@/modules/quotes/quote-status-badge";
import { PhotoUploader, PhotoThumb } from "@/modules/shared/photo-uploader";
import { MaterialsUsedPanel } from "./materials-used-panel";
import { ScheduleJobCard } from "./schedule-job-card";
import { CheckInPrepDialog } from "./check-in-prep-dialog";
import { useFeature } from "@/hooks/use-features";

export function JobDetail({ id }: { id: string }) {
  const j = trpc.jobs.get.useQuery({ id });
  const update = trpc.jobs.update.useMutation();
  const toggle = trpc.jobs.toggleChecklistItem.useMutation();
  const utils = trpc.useUtils();

  const openEntry = trpc.time.openEntry.useQuery();
  const clockIn = trpc.time.clockIn.useMutation();
  const clockOut = trpc.time.clockOut.useMutation();

  const mobileCheckIn = useFeature("operations.mobile_check_in");
  const [checkInPrepOpen, setCheckInPrepOpen] = useState(false);

  if (j.isLoading) return <Skeleton className="h-64 mx-auto max-w-6xl" />;
  if (j.error) return <p className="mx-auto max-w-6xl text-sm text-red-600">{j.error.message}</p>;
  const job = j.data!;

  const mobileCheckInEnabled =
    mobileCheckIn.state === "enabled" || mobileCheckIn.state === "beta";

  async function setStatus(status: string) {
    // Intercept "checked_in" — Pro+ orgs go through the prep dialog first
    // (photo capture on phone OR liability opt-out). Everyone else falls
    // through to the direct status update.
    if (status === "checked_in" && mobileCheckInEnabled) {
      setCheckInPrepOpen(true);
      return;
    }
    try {
      await update.mutateAsync({ id, status });
      toast.success(`Moved to ${jobStageLabel(status)}.`);
      await utils.jobs.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onToggle(itemId: string, completed: boolean) {
    try {
      await toggle.mutateAsync({ id: itemId, completed });
      await utils.jobs.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const vehicleLabel =
    [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model, job.vehicle?.trim]
      .filter(Boolean)
      .join(" ") || "(no vehicle)";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Production board
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono tabular-nums text-2xl font-semibold tracking-tight">
              J-{String(job.number).padStart(4, "0")}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/customers/${job.customer.id}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <User className="h-3.5 w-3.5" />
              {job.customer.name}
            </Link>
            {job.vehicle && (
              <Link
                href={`/vehicles/${job.vehicle.id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Car className="h-3.5 w-3.5" />
                {vehicleLabel}
              </Link>
            )}
            {job.quote && (
              <Link
                href={`/quotes/${job.quote.id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                Q-{String(job.quote.number).padStart(4, "0")}
                <span className="text-xs">({formatMoney(job.quote.totalCents)})</span>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={job.status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(job.status === "approved" || job.status === "ready") && !job.scheduledStart && (
        <ScheduleJobCard
          jobId={job.id}
          jobNumber={job.number}
          estimatedHours={
            job.estimatedHours != null ? Number(job.estimatedHours) : null
          }
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">
            Checklist ({job.workOrder?.items.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="qc">QC</TabsTrigger>
          <TabsTrigger value="photos">Photos ({job.photos.length})</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Job
              </h3>
              <dl className="space-y-1.5 text-sm">
                <Field label="Title" value={job.title} />
                <Field label="Priority" value={job.priority} />
                <Field label="Bay" value={job.bay?.name ?? null} />
                <Field
                  label="Scheduled"
                  value={
                    job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleString()
                      : null
                  }
                />
                <Field
                  label="Estimated hours"
                  value={job.estimatedHours ? Number(job.estimatedHours).toFixed(1) : null}
                />
                <Field
                  label="Actual hours"
                  value={job.actualHours ? Number(job.actualHours).toFixed(1) : null}
                />
              </dl>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Quote line items
              </h3>
              {job.quote ? (
                <ul className="divide-y text-sm">
                  {job.quote.items
                    .filter((i) => !i.isUpsell || i.upsellAccepted)
                    .map((i) => (
                      <li key={i.id} className="flex justify-between py-1.5">
                        <span className="truncate">{i.description}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatMoney(i.totalCents)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No linked quote — manual job.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4 md:col-span-2">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Summary
              </h3>
              <p className="text-sm whitespace-pre-wrap">
                {job.summary || <span className="text-muted-foreground">—</span>}
              </p>
            </div>

            <div className="md:col-span-2">
              <MaterialsUsedPanel jobId={id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          {!job.workOrder || job.workOrder.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No checklist attached. Create a ChecklistTemplate in Settings and it will
              auto-attach to future jobs.
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {job.workOrder.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(item.completedAt)}
                    onChange={(e) =>
                      onToggle(item.id, e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className={item.completedAt ? "line-through text-muted-foreground" : ""}>
                      {item.section ? (
                        <span className="mr-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {item.section}
                        </span>
                      ) : null}
                      {item.label}
                    </div>
                    {item.note && (
                      <div className="mt-1 text-xs text-muted-foreground">{item.note}</div>
                    )}
                  </div>
                  {item.completedAt && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="checkin" className="mt-4">
          <CheckInPanel jobId={id} existing={job.checkIn} />
        </TabsContent>

        <TabsContent value="qc" className="mt-4">
          <QCPanel jobId={id} existing={job.qcCheck} />
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <PhotosPanel jobId={id} photos={job.photos} />
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Clock in/out
              </h3>
              {openEntry.data?.jobId === job.id ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await clockOut.mutateAsync({
                        id: openEntry.data!.id,
                        breakMinutes: 0,
                      });
                      toast.success("Clocked out.");
                      await utils.jobs.get.invalidate({ id });
                      await utils.time.openEntry.invalidate();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Square className="mr-1 h-3.5 w-3.5" /> Clock out
                </Button>
              ) : openEntry.data ? (
                <div className="text-xs text-muted-foreground">
                  You&apos;re clocked in on{" "}
                  <Link
                    href={`/jobs/${openEntry.data.job?.id}`}
                    className="hover:underline"
                  >
                    J-{String(openEntry.data.job?.number ?? 0).padStart(4, "0")}
                  </Link>{" "}
                  — clock out there first.
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await clockIn.mutateAsync({ jobId: id });
                      toast.success("Clocked in.");
                      await utils.jobs.get.invalidate({ id });
                      await utils.time.openEntry.invalidate();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Clock in on this job
                </Button>
              )}
            </div>

            {job.timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No time entries yet.</p>
            ) : (
              <ul className="divide-y">
                {job.timeEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Timer className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono tabular-nums">
                        {new Date(entry.clockIn).toLocaleString()}
                      </span>
                      {entry.clockOut && (
                        <span className="ml-2 text-muted-foreground">
                          → {new Date(entry.clockOut).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.clockOut
                        ? `${formatDuration(new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime() - entry.breakMinutes * 60_000)}`
                        : "in progress…"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        {job.status === "checked_in" && (
          <Button variant="outline" onClick={() => setStatus("prep")}>Start prep</Button>
        )}
        {job.status === "prep" && (
          <Button variant="outline" onClick={() => setStatus("in_progress")}>Start install</Button>
        )}
        {job.status === "in_progress" && (
          <Button variant="outline" onClick={() => setStatus("qc")}>Send to QC</Button>
        )}
        {job.status === "ready_for_pickup" && (
          <MarkDeliveredButton
            id={id}
            onDelivered={async () => await utils.jobs.get.invalidate({ id })}
          />
        )}
      </div>

      <CheckInPrepDialog
        open={checkInPrepOpen}
        onOpenChange={setCheckInPrepOpen}
        jobId={id}
        jobNumber={job.number}
        onDone={(transitioned) => {
          setCheckInPrepOpen(false);
          if (transitioned) {
            void utils.jobs.get.invalidate({ id });
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MarkDeliveredButton({
  id,
  onDelivered,
}: {
  id: string;
  onDelivered: () => Promise<void>;
}) {
  const mut = trpc.jobs.markDelivered.useMutation();
  return (
    <Button
      onClick={async () => {
        try {
          await mut.mutateAsync({ id });
          toast.success("Delivered.");
          await onDelivered();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
      disabled={mut.isPending}
    >
      Mark delivered
    </Button>
  );
}

function CheckInPanel({
  jobId,
  existing,
}: {
  jobId: string;
  existing: {
    id: string;
    mileage: number | null;
    fuelLevelEighths: number | null;
    warningLights: string[];
    customerSignatureName: string | null;
    performedAt: Date;
  } | null;
}) {
  const [mileage, setMileage] = useState(existing?.mileage?.toString() ?? "");
  const [fuel, setFuel] = useState(existing?.fuelLevelEighths?.toString() ?? "4");
  const [warnings, setWarnings] = useState(existing?.warningLights.join(", ") ?? "");
  const [signatureName, setSignatureName] = useState(existing?.customerSignatureName ?? "");
  const [conditionNotes, setConditionNotes] = useState("");
  const submit = trpc.jobs.submitCheckIn.useMutation();
  const utils = trpc.useUtils();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await submit.mutateAsync({
        jobId,
        mileage: mileage ? Number(mileage) : null,
        fuelLevelEighths: fuel ? Number(fuel) : null,
        warningLights: warnings
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        exteriorConditionJson: { notes: conditionNotes },
        interiorConditionJson: {},
        damagePhotoFileIds: [],
        overallPhotoFileIds: [],
        keysReceived: 1,
        belongingsAcknowledged: true,
        customerSignatureName: signatureName || undefined,
      });
      toast.success("Vehicle checked in.");
      await utils.jobs.get.invalidate({ id: jobId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Mileage</label>
          <input
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="12340"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Fuel (0-8, 4 = ½ tank)
          </label>
          <input
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            type="number"
            min={0}
            max={8}
            value={fuel}
            onChange={(e) => setFuel(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Warning lights (comma-separated)
        </label>
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={warnings}
          onChange={(e) => setWarnings(e.target.value)}
          placeholder="TPMS, service engine"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Existing damage notes
        </label>
        <Textarea
          rows={3}
          value={conditionNotes}
          onChange={(e) => setConditionNotes(e.target.value)}
          placeholder="Front bumper scratch driver side, small dent rear tailgate…"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The click-to-mark SVG car diagram lives behind the
          <span className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
            visualizer.vehicle_3d
          </span>
          feature flag — coming soon. Free-text notes work today.
        </p>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Customer signature (typed name)
        </label>
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={signatureName}
          onChange={(e) => setSignatureName(e.target.value)}
          placeholder="Customer types their name on the tablet"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : existing ? "Update check-in" : "Complete check-in"}
        </Button>
      </div>
    </form>
  );
}

function QCPanel({
  jobId,
  existing,
}: {
  jobId: string;
  existing: {
    id: string;
    passed: boolean;
    notes: string | null;
    passedAt: Date;
  } | null;
}) {
  const [passed, setPassed] = useState(existing?.passed ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [punchList, setPunchList] = useState<string>("");
  const submit = trpc.jobs.submitQC.useMutation();
  const utils = trpc.useUtils();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = punchList
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label, resolved: false }));
    try {
      await submit.mutateAsync({
        jobId,
        passed,
        notes: notes || undefined,
        punchListJson: items,
        photoFileIds: [],
      });
      toast.success(passed ? "QC passed." : "QC saved with punch list.");
      await utils.jobs.get.invalidate({ id: jobId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={passed}
            onChange={(e) => setPassed(e.target.checked)}
          />
          QC passed — send to Ready
        </label>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          QC notes
        </label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Punch list (one item per line)
        </label>
        <Textarea
          rows={4}
          value={punchList}
          onChange={(e) => setPunchList(e.target.value)}
          placeholder={"Redo hood corner\nHeat set rear quarter\nClean edge on trunk"}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : existing ? "Update QC" : "Submit QC"}
        </Button>
      </div>
    </form>
  );
}

function PhotosPanel({
  jobId,
  photos,
}: {
  jobId: string;
  photos: Array<{ id: string; fileId: string; phase: string; caption: string | null }>;
}) {
  const [phase, setPhase] = useState<PhotoPhaseKey>("before");
  const addPhoto = trpc.jobs.addPhoto.useMutation();
  const utils = trpc.useUtils();

  const byPhase = new Map<string, typeof photos>();
  for (const p of photos) {
    const arr = byPhase.get(p.phase) ?? [];
    arr.push(p);
    byPhase.set(p.phase, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <Select value={phase} onValueChange={(v) => v && setPhase(v as PhotoPhaseKey)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_PHASES.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PhotoUploader
          label={`Add ${phase} photos`}
          entityType="job"
          entityId={jobId}
          onUploaded={async (fileId) => {
            try {
              await addPhoto.mutateAsync({ jobId, fileId, phase });
              await utils.jobs.get.invalidate({ id: jobId });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Add failed");
            }
          }}
        />
      </div>

      {PHOTO_PHASES.map((ph) => {
        const rows = byPhase.get(ph.key) ?? [];
        if (rows.length === 0) return null;
        return (
          <div key={ph.key}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {ph.label} ({rows.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {rows.map((r) => (
                <PhotoThumb key={r.id} fileId={r.fileId} size="md" />
              ))}
            </div>
          </div>
        );
      })}

      {photos.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No photos yet. Use the button above to upload — thumbnails generate in the background.
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value || <span className="text-muted-foreground/60">—</span>}
      </dd>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
