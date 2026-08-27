"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Small admin form for the org's review URLs + primary provider.
 * Backing state lives on Organization.settings.reviews (JSON blob).
 * The job-delivered aftermath fn reads from here when queuing the request.
 */
export function ReviewSettings() {
  const q = trpc.reviews.getSettings.useQuery();
  const save = trpc.reviews.saveSettings.useMutation();

  const [googleUrl, setGoogleUrl] = useState("");
  const [yelpUrl, setYelpUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [primary, setPrimary] = useState<"google" | "yelp" | "facebook" | "manual">(
    "google",
  );

  useEffect(() => {
    if (!q.data) return;
    setGoogleUrl(q.data.googleUrl ?? "");
    setYelpUrl(q.data.yelpUrl ?? "");
    setFacebookUrl(q.data.facebookUrl ?? "");
    setManualUrl(q.data.manualUrl ?? "");
    setPrimary(q.data.primary ?? "google");
  }, [q.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        googleUrl: googleUrl || undefined,
        yelpUrl: yelpUrl || undefined,
        facebookUrl: facebookUrl || undefined,
        manualUrl: manualUrl || undefined,
        primary,
      });
      toast.success("Review settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (q.isLoading) return <Skeleton className="h-64" />;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Review requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          After a job is delivered we send the customer a one-click link to your primary
          review platform. Requires a customer email on file.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="google">Google Business Profile URL</Label>
          <Input
            id="google"
            placeholder="https://g.page/r/…/review"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yelp">Yelp URL</Label>
          <Input
            id="yelp"
            placeholder="https://www.yelp.com/writeareview/biz/…"
            value={yelpUrl}
            onChange={(e) => setYelpUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb">Facebook URL</Label>
          <Input
            id="fb"
            placeholder="https://www.facebook.com/…/reviews"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual">Other URL</Label>
          <Input
            id="manual"
            placeholder="https://…"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Primary platform</Label>
        <Select
          value={primary}
          onValueChange={(v) =>
            v && setPrimary(v as "google" | "yelp" | "facebook" | "manual")
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="yelp">Yelp</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="manual">Other URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
