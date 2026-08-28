"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trpc } from "@/lib/trpc/client";
import type { IntegrationDef } from "@/lib/integrations";

/**
 * Generic form for editing an integration's per-tenant config. The set of
 * inputs comes from `def.configFields`. Secret inputs never surface the
 * value that the server currently has stored — the placeholder just says
 * "override" so the shop knows they can leave it blank to keep whatever's
 * there.
 */
export function IntegrationConfigDialog({
  open,
  onOpenChange,
  def,
  populatedFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  def: IntegrationDef;
  /** Which config keys currently have a tenant override in place. */
  populatedFields: string[];
}) {
  const save = trpc.integrations.saveConfig.useMutation();
  const test = trpc.integrations.testConnection.useMutation();
  const revert = trpc.integrations.revertToDefault.useMutation();
  const utils = trpc.useUtils();

  const [values, setValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<
    { ok: boolean; message?: string } | null
  >(null);
  const [confirmRevert, setConfirmRevert] = useState(false);

  // Fresh state each time the modal opens — never carry secrets over.
  useEffect(() => {
    if (!open) return;
    setValues({});
    setTestResult(null);
  }, [open]);

  const hasOverride = populatedFields.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Missing required fields the tenant hasn't previously set are blocked
    // client-side; server enforces the same but the toast is faster.
    for (const f of def.configFields ?? []) {
      if (!f.required) continue;
      if (populatedFields.includes(f.key)) continue;
      if (!values[f.key]?.trim()) {
        toast.error(`${f.label} is required.`);
        return;
      }
    }
    try {
      await save.mutateAsync({
        provider: def.id as never,
        fields: values,
      });
      await utils.integrations.listOverrides.invalidate();
      toast.success(`${def.name} settings saved.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onTest() {
    setTestResult(null);
    try {
      const res = await test.mutateAsync({
        provider: def.id as never,
        fields: values,
      });
      setTestResult(res);
      if (res.ok) toast.success("Connection OK.");
      else toast.error(res.message ?? "Connection failed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  }

  async function onRevert() {
    try {
      await revert.mutateAsync({ provider: def.id as never });
      await utils.integrations.listOverrides.invalidate();
      toast.success(
        `${def.name} reverted to platform default. Your saved key + from address were removed.`,
      );
      setConfirmRevert(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revert failed");
      throw err;
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{def.name} settings</DialogTitle>
            <DialogDescription>
              {hasOverride
                ? "Your shop has its own override in place. Update or clear individual fields; blank fields keep the currently-saved value."
                : "Your shop currently uses the WrapShop OS platform default. Add your own credentials to send from your domain."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            {def.configFields?.map((field) => {
              const savedPlaceholder = populatedFields.includes(field.key)
                ? "•••••••• (leave blank to keep)"
                : field.placeholder;
              return (
                <div key={field.key}>
                  <Label htmlFor={`ic-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`ic-${field.key}`}
                    type={
                      field.type === "secret"
                        ? "password"
                        : field.type === "email"
                          ? "email"
                          : "text"
                    }
                    value={values[field.key] ?? ""}
                    placeholder={savedPlaceholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {field.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                </div>
              );
            })}

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  testResult.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                    : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.ok
                  ? "Connection is healthy."
                  : (testResult.message ?? "Connection failed.")}
              </div>
            )}

            <DialogFooter className="justify-between sm:justify-between">
              <div className="flex items-center gap-2">
                {hasOverride && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmRevert(true)}
                    disabled={save.isPending || revert.isPending}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Revert to platform default
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTest}
                  disabled={test.isPending || save.isPending}
                >
                  {test.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Test connection
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title={`Revert ${def.name}?`}
        description={`This deletes your shop's saved ${def.name} credentials. Outbound email will fall back to the WrapShop OS platform default.`}
        confirmLabel="Revert"
        onConfirm={onRevert}
      />
    </>
  );
}
