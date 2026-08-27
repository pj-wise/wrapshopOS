"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Loader2 } from "lucide-react";
import type { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCustomerInput } from "@/lib/schemas/crm";
import { trpc } from "@/lib/trpc/client";
import { COMMON_MAKES, modelYearOptions } from "@/lib/vehicle-makes";

type FormValues = z.input<typeof createCustomerInput>;

/**
 * Vehicle-fields state carried alongside the customer form. Kept out of
 * react-hook-form because it's off-schema (Vehicle is a separate model) and
 * the cascade logic is simpler with plain useState.
 */
type VehicleState = {
  year: string;
  make: string;
  makeOther: string;
  model: string;
  trim: string;
  color: string;
  plate: string;
  vin: string;
  /** Free-text description used by the Manual tab (non-cars, obscure vehicles). */
  manualText: string;
};

const OTHER_MAKE_SENTINEL = "__other__";

const EMPTY_VEHICLE: VehicleState = {
  year: "",
  make: "",
  makeOther: "",
  model: "",
  trim: "",
  color: "",
  plate: "",
  vin: "",
  manualText: "",
};

export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const createCustomer = trpc.customers.create.useMutation();
  const createVehicle = trpc.vehicles.create.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(createCustomerInput),
    defaultValues: {
      type: "individual",
      name: "",
      email: "",
      phone: "",
      notes: "",
      country: "US",
      marketingConsent: false,
      tags: [],
    },
  });

  const type = form.watch("type");
  const [vehicle, setVehicle] = useState<VehicleState>(EMPTY_VEHICLE);
  const [vehicleTab, setVehicleTab] = useState<"select" | "manual">("select");
  const years = useMemo(() => modelYearOptions(), []);
  const effectiveMake =
    vehicle.make === OTHER_MAKE_SENTINEL ? vehicle.makeOther.trim() : vehicle.make;

  // Only fetch NHTSA models when the user is actually on the Select tab —
  // no point burning an API call while they're typing in Manual.
  const canLoadModels = Boolean(vehicleTab === "select" && vehicle.year && effectiveMake);
  const modelsQ = trpc.vehicles.models.useQuery(
    { year: Number(vehicle.year), make: effectiveMake },
    { enabled: canLoadModels, staleTime: 5 * 60 * 1000 },
  );

  function resetAll() {
    form.reset();
    setVehicle(EMPTY_VEHICLE);
    setVehicleTab("select");
  }

  async function onSubmit(values: FormValues) {
    try {
      const created = await createCustomer.mutateAsync(values);

      // If the shop entered anything vehicle-y, create a Vehicle attached to
      // the new customer. Non-fatal: if it fails we surface a warning but keep
      // the customer so the shop can add the vehicle from the detail page later.
      const manualPayload =
        vehicleTab === "manual" && vehicle.manualText.trim()
          ? parseManualVehicleText(vehicle.manualText)
          : null;

      const hasVehicleData =
        Boolean(manualPayload) ||
        vehicle.year ||
        effectiveMake ||
        vehicle.model ||
        vehicle.trim ||
        vehicle.color ||
        vehicle.plate ||
        vehicle.vin;

      if (hasVehicleData) {
        try {
          await createVehicle.mutateAsync({
            customerId: created.id,
            year: manualPayload?.year ?? (vehicle.year ? Number(vehicle.year) : null),
            make: manualPayload?.make ?? effectiveMake ?? undefined,
            model: vehicleTab === "manual" ? undefined : vehicle.model || undefined,
            trim: vehicleTab === "manual" ? undefined : vehicle.trim || undefined,
            color: vehicle.color || undefined,
            plate: vehicle.plate || undefined,
            vin: vehicle.vin || undefined,
          });
        } catch (err) {
          toast.warning(
            `Customer saved, but vehicle wasn't added: ${
              err instanceof Error ? err.message : "unknown"
            }. Add it from the customer page.`,
          );
        }
      }

      toast.success(`Customer "${created.name}" created.`);
      resetAll();
      onOpenChange(false);
      await Promise.all([
        utils.customers.list.invalidate(),
        utils.vehicles.list.invalidate(),
      ]);
      if (onCreated) {
        onCreated(created.id);
      } else {
        router.push(`/customers/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  const pending = createCustomer.isPending || createVehicle.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAll();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form
          onSubmit={(e) => {
            // React portals propagate synthetic events up through the React
            // tree — this dialog is often opened inside another <form> (e.g.
            // QuoteBuilder). Stop propagation so the parent form doesn't
            // also fire on submit.
            e.stopPropagation();
            void form.handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              Add a shop customer. Optionally attach their first vehicle now.
            </DialogDescription>
          </DialogHeader>

          {/* ---- Customer fields ---------------------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1 space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => form.setValue("type", v as FormValues["type"])}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label htmlFor="name">
                {type === "business" ? "Company name" : "Full name"}
              </Label>
              <Input
                id="name"
                placeholder={type === "business" ? "Apex Fleet Services" : "Marcus Chen"}
                {...form.register("name")}
              />
            </div>
          </div>

          {type === "business" && (
            <div className="space-y-1.5">
              <Label htmlFor="businessName">DBA / brand (optional)</Label>
              <Input id="businessName" {...form.register("businessName")} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="marcus@example.com"
                {...form.register("email")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 555-1212"
                {...form.register("phone")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Anything the shop should remember about this customer"
              rows={2}
              {...form.register("notes")}
            />
          </div>

          {/* ---- Vehicle (optional) ------------------------------------- */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Car className="h-3.5 w-3.5" /> Vehicle (optional)
            </div>

            <Tabs
              value={vehicleTab}
              onValueChange={(v) => setVehicleTab(v as "select" | "manual")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select">Select</TabsTrigger>
                <TabsTrigger value="manual">Manual entry</TabsTrigger>
              </TabsList>

              {/* ---- Select: cascading Year → Make → Model ------------ */}
              <TabsContent value="select" className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Select
                      value={vehicle.year}
                      onValueChange={(v) =>
                        setVehicle((s) => ({ ...s, year: v ?? "", model: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Year…" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Make</Label>
                    <Select
                      value={vehicle.make}
                      onValueChange={(v) =>
                        setVehicle((s) => ({
                          ...s,
                          make: v ?? "",
                          makeOther: "",
                          model: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Make…" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_MAKES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_MAKE_SENTINEL}>Other…</SelectItem>
                      </SelectContent>
                    </Select>
                    {vehicle.make === OTHER_MAKE_SENTINEL && (
                      <Input
                        placeholder="Type make…"
                        value={vehicle.makeOther}
                        onChange={(e) =>
                          setVehicle((s) => ({
                            ...s,
                            makeOther: e.target.value,
                            model: "",
                          }))
                        }
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Model</Label>
                    <Select
                      value={vehicle.model}
                      onValueChange={(v) => setVehicle((s) => ({ ...s, model: v ?? "" }))}
                      disabled={!canLoadModels}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !vehicle.year || !effectiveMake
                              ? "Pick year + make first"
                              : modelsQ.isLoading
                                ? "Loading…"
                                : (modelsQ.data?.models.length ?? 0) === 0
                                  ? "No models found"
                                  : "Model…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(modelsQ.data?.models ?? []).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {modelsQ.isFetching && canLoadModels && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading from NHTSA…
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trim</Label>
                    <Input
                      placeholder="e.g. Competition Package"
                      value={vehicle.trim}
                      onChange={(e) => setVehicle((s) => ({ ...s, trim: e.target.value }))}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ---- Manual: one free-text field ---------------------- */}
              <TabsContent value="manual" className="mt-3">
                <div className="space-y-1.5">
                  <Label>Vehicle</Label>
                  <Input
                    placeholder="e.g. 2019 Kawasaki Ninja 400"
                    value={vehicle.manualText}
                    onChange={(e) =>
                      setVehicle((s) => ({ ...s, manualText: e.target.value }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use this for non-car items (motorcycle, boat, RV) or vehicles the
                    lookup doesn&apos;t return. Type the whole description.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Shared identifiers — always visible under both tabs. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Color{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  placeholder="e.g. Frozen Portimao Blue"
                  value={vehicle.color}
                  onChange={(e) => setVehicle((s) => ({ ...s, color: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Plate{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  placeholder="ABC-1234"
                  value={vehicle.plate}
                  onChange={(e) => setVehicle((s) => ({ ...s, plate: e.target.value }))}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1">
                  VIN{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  placeholder="17-character VIN"
                  maxLength={17}
                  className="font-mono uppercase tracking-wider"
                  value={vehicle.vin}
                  onChange={(e) =>
                    setVehicle((s) => ({ ...s, vin: e.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Best-effort parse of a free-text vehicle description. If the string starts
 * with a plausible 4-digit year, split it off so the vehicle list can render a
 * dedicated year column. Everything else goes into `make` — the DB doesn't
 * care and the list UI joins year+make+model+trim with spaces when it renders
 * the title, so "2019 Kawasaki Ninja 400" displays cleanly.
 */
function parseManualVehicleText(input: string): { year: number | null; make: string } {
  const trimmed = input.trim();
  const yearMatch = trimmed.match(/^(19|20)(\d{2})\s+(.+)$/);
  if (yearMatch) {
    const yearNum = Number(yearMatch[1] + yearMatch[2]);
    const now = new Date().getFullYear();
    if (yearNum >= 1900 && yearNum <= now + 2) {
      return { year: yearNum, make: yearMatch[3] ?? trimmed };
    }
  }
  return { year: null, make: trimmed };
}
