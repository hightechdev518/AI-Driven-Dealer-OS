"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Plus,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FbListingBadge } from "@/components/fb-listing-badge";
import { FbPublishDialog } from "@/components/fb-publish-dialog";
import { VehiclePhoto } from "@/components/inventory/vehicle-photo";
import { VehicleStatsGrid } from "@/components/inventory/vehicle-stats-grid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehicleForm } from "@/components/vehicle-form";
import type { AiPriority, MarketComp, Vehicle, VehicleFormData } from "@/lib/types";
import { generateAiSummary, getVehicleLabel } from "@/lib/vehicle-logic";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

function getUrgencyLevel(priority: AiPriority | null | undefined): UrgencyLevel {
  switch (priority) {
    case "URGENT":
    case "AUCTION":
      return "URGENT";
    case "LIST NOW":
    case "PRICE DROP":
      return "HIGH";
    case "MONEY TRAP":
    case "PASS":
    case "BUY":
      return "MEDIUM";
    case "HOLD":
    default:
      return "LOW";
  }
}

const urgencyBadgeStyles: Record<UrgencyLevel, string> = {
  LOW: "bg-emerald-500/25 text-emerald-300 ring-emerald-400/30",
  MEDIUM: "bg-sky-500/25 text-sky-300 ring-sky-400/30",
  HIGH: "bg-amber-500/25 text-amber-300 ring-amber-400/35",
  URGENT: "bg-red-500/25 text-red-300 ring-red-400/35",
};

function getDisplayScore(vehicle: Vehicle): number {
  if (vehicle.ai_confidence != null) return Math.round(vehicle.ai_confidence);

  let score = 72;
  const roi = vehicle.roi ?? 0;
  const days = vehicle.days_in_stock ?? 0;

  if (roi > 20) score += 12;
  else if (roi > 10) score += 6;
  else if (roi < 5) score -= 8;
  if (days < 14) score += 8;
  else if (days > 60) score -= 18;
  else if (days > 45) score -= 10;
  if (!vehicle.listed_online) score += 4;

  return Math.min(99, Math.max(40, score));
}

function getMarketComparison(vehicle: Vehicle): {
  label: string;
  positive: boolean;
} | null {
  if (vehicle.market_avg == null || vehicle.recommended_price == null) return null;

  const pct =
    ((vehicle.recommended_price - vehicle.market_avg) / vehicle.market_avg) * 100;
  const abs = Math.abs(pct).toFixed(1);

  return {
    label: `${abs}% vs avg`,
    positive: pct >= 0,
  };
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [comps, setComps] = useState<MarketComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compForm, setCompForm] = useState({
    source: "",
    location: "",
    listing_price: "",
    mileage: "",
    url: "",
    source_notes: "",
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/vehicles/${id}`).then((r) => r.json()),
      fetch(`/api/market-comps?vehicle_id=${id}`).then((r) => r.json()),
    ])
      .then(([vehicleData, compsData]) => {
        if (vehicleData.error) throw new Error(vehicleData.error);
        setVehicle(vehicleData);
        setComps(Array.isArray(compsData) ? compsData : []);
      })
      .catch((err) => {
        console.error(err);
        setVehicle(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = async (data: VehicleFormData) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Failed to update");
    const updated = await res.json();
    setVehicle({
      ...updated,
      image_url: updated.image_url ?? data.image_url ?? null,
    });
    setEditing(false);
  };

  const handleAddComp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/market-comps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: id,
        year: vehicle?.year,
        make: vehicle?.make,
        model: vehicle?.model,
        mileage: compForm.mileage ? parseInt(compForm.mileage) : null,
        source: compForm.source,
        location: compForm.location,
        listing_price: compForm.listing_price
          ? parseFloat(compForm.listing_price)
          : null,
        url: compForm.url,
        source_notes: compForm.source_notes,
      }),
    });

    if (!res.ok) throw new Error("Failed to add comp");
    setCompDialogOpen(false);
    setCompForm({
      source: "",
      location: "",
      listing_price: "",
      mileage: "",
      url: "",
      source_notes: "",
    });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading vehicle...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-slate-400">Vehicle not found.</p>
        <Button variant="outline" onClick={() => router.push("/inventory")}>
          Back to Inventory
        </Button>
      </div>
    );
  }

  const urgency = getUrgencyLevel(vehicle.ai_priority);
  const score = getDisplayScore(vehicle);
  const days = vehicle.days_in_stock ?? 0;
  const marketComparison = getMarketComparison(vehicle);
  const title = getVehicleLabel(vehicle);
  const subtitle = [
    vehicle.vin ? `VIN ${vehicle.vin}` : "No VIN",
    vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} mi` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Link>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0e14] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <div className="relative aspect-[21/9] min-h-[200px] w-full overflow-hidden sm:aspect-[2/1]">
          <VehiclePhoto
            key={vehicle.image_url ?? vehicle.id}
            vehicle={vehicle}
            overlay
            className="h-full w-full object-cover brightness-[1.3]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0e14]/95 via-[#0b0e14]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap items-start gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur-md",
                urgencyBadgeStyles[urgency]
              )}
            >
              <Sparkles className="h-3 w-3 shrink-0 opacity-90" />
              {urgency}
            </span>
            {!vehicle.listed_online && (
              <span className="inline-flex items-center rounded-full bg-violet-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200 ring-1 ring-inset ring-violet-400/30 backdrop-blur-md">
                Unlisted
              </span>
            )}
            <FbListingBadge status={vehicle.fb_listing_status} />
          </div>

          <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/30 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-inset ring-sky-400/30 backdrop-blur-md">
              <Sparkles className="h-3 w-3 opacity-80" />
              {score}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/10 backdrop-blur-md">
              <Clock className="h-3 w-3 opacity-70" />
              {days}d
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-12 sm:px-6 sm:pb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-300/90 sm:text-base">{subtitle}</p>
            <p className="mt-2 text-xs text-slate-500">
              {vehicle.status ?? "In Stock"}
              {vehicle.online_channel ? ` · ${vehicle.online_channel}` : ""}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <VehicleStatsGrid vehicle={vehicle} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricPill label="ROI" value={formatPercent(vehicle.roi)} accent />
            <MetricPill label="My Cost" value={formatCurrency(vehicle.my_cost)} />
            <MetricPill label="Repair" value={formatCurrency(vehicle.repair_cost)} />
            <MetricPill
              label="Recommended"
              value={formatCurrency(vehicle.recommended_price)}
              accent="sky"
            />
          </div>

          <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/80" />
            <span>{vehicle.action_required ?? "No action required."}</span>
          </p>

          {vehicle.recommended_price != null && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-slate-200">
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-sky-400/90">AI:</span>
                {formatCurrency(vehicle.recommended_price)}
              </p>
              {marketComparison && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                    marketComparison.positive ? "text-slate-400" : "text-amber-400/90"
                  )}
                >
                  {marketComparison.positive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {marketComparison.label}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <FbPublishDialog vehicle={vehicle} onPublished={loadData} />
            <Button
              variant={editing ? "secondary" : "outline"}
              onClick={() => setEditing(!editing)}
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            >
              {editing ? "Cancel Edit" : "Edit Vehicle"}
            </Button>
            {vehicle.fb_listing_url && (
              <Button variant="outline" asChild className="border-white/10 bg-white/[0.03]">
                <a
                  href={vehicle.fb_listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View FB Listing
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {editing ? (
        <section className="rounded-2xl border border-white/[0.07] bg-[#0b0e14] p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Edit Vehicle</h2>
          <VehicleForm
            initialData={vehicle}
            onSubmit={handleUpdate}
            onImageUrlChange={(url) =>
              setVehicle((current) =>
                current ? { ...current, image_url: url } : current
              )
            }
            submitLabel="Save Changes"
          />
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/[0.07] bg-[#0b0e14] p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
                Vehicle Details
              </h2>
              <dl className="space-y-0 text-sm">
                <DetailRow label="VIN" value={vehicle.vin} />
                <DetailRow
                  label="Mileage"
                  value={
                    vehicle.mileage
                      ? `${vehicle.mileage.toLocaleString()} mi`
                      : null
                  }
                />
                <DetailRow label="Bought Date" value={vehicle.bought_date} />
                <DetailRow
                  label="Days in Stock"
                  value={vehicle.days_in_stock != null ? `${vehicle.days_in_stock} days` : null}
                />
                <DetailRow
                  label="Listed Online"
                  value={vehicle.listed_online ? "Yes" : "No"}
                />
                <DetailRow label="Channel" value={vehicle.online_channel} />
                <DetailRow label="Status" value={vehicle.status} />
                <DetailRow label="Notes" value={vehicle.notes} multiline />
              </dl>
            </section>

            <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sky-400/90">
                <Sparkles className="h-4 w-4" />
                AI Summary
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                {generateAiSummary(vehicle)}
              </p>
              {vehicle.market_avg != null && (
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-black/20 p-3 text-center text-xs">
                  <div>
                    <p className="text-slate-500">Low</p>
                    <p className="mt-0.5 font-semibold text-white">
                      {formatCurrency(vehicle.market_low)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Avg</p>
                    <p className="mt-0.5 font-semibold text-sky-400">
                      {formatCurrency(vehicle.market_avg)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">High</p>
                    <p className="mt-0.5 font-semibold text-white">
                      {formatCurrency(vehicle.market_high)}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-white/[0.07] bg-[#0b0e14] p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Market Comps</h2>
                <p className="text-sm text-slate-500">
                  {comps.length} comp{comps.length !== 1 ? "s" : ""} on file
                </p>
              </div>
              <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Add Comp
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Market Comp</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddComp} className="space-y-4">
                    <div>
                      <Label htmlFor="source">Source</Label>
                      <Input
                        id="source"
                        placeholder="Cars.com, Facebook, etc."
                        value={compForm.source}
                        onChange={(e) =>
                          setCompForm({ ...compForm, source: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={compForm.location}
                        onChange={(e) =>
                          setCompForm({ ...compForm, location: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="listing_price">Listing Price ($)</Label>
                        <Input
                          id="listing_price"
                          type="number"
                          value={compForm.listing_price}
                          onChange={(e) =>
                            setCompForm({
                              ...compForm,
                              listing_price: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="comp_mileage">Mileage</Label>
                        <Input
                          id="comp_mileage"
                          type="number"
                          value={compForm.mileage}
                          onChange={(e) =>
                            setCompForm({ ...compForm, mileage: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="url">URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={compForm.url}
                        onChange={(e) =>
                          setCompForm({ ...compForm, url: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="source_notes">Notes</Label>
                      <Input
                        id="source_notes"
                        value={compForm.source_notes}
                        onChange={(e) =>
                          setCompForm({ ...compForm, source_notes: e.target.value })
                        }
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Save Comp
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {comps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-400">
                No market comps yet. Add competitor listings to improve pricing.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Mileage</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Link</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map((comp) => (
                      <tr
                        key={comp.id}
                        className="border-b border-white/[0.04] text-slate-300 last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {comp.source}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatCurrency(comp.listing_price)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {comp.mileage
                            ? `${comp.mileage.toLocaleString()} mi`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">{comp.location ?? "—"}</td>
                        <td className="px-4 py-3">
                          {comp.url ? (
                            <a
                              href={comp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {comp.date_checked ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean | "sky";
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums",
          accent === "sky"
            ? "text-sky-400"
            : accent
              ? "text-emerald-400"
              : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex border-b border-white/[0.06] py-3 last:border-0",
        multiline ? "flex-col gap-1" : "items-start justify-between gap-4"
      )}
    >
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd
        className={cn(
          "text-slate-200",
          multiline ? "text-sm leading-relaxed" : "text-right text-sm font-medium"
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
