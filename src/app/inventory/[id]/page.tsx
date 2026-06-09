"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FbListingBadge } from "@/components/fb-listing-badge";
import { FbPublishDialog } from "@/components/fb-publish-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriorityBadge } from "@/components/priority-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VehicleForm } from "@/components/vehicle-form";
import type { MarketComp, Vehicle, VehicleFormData } from "@/lib/types";
import {
  generateAiSummary,
  getVehicleLabel,
} from "@/lib/vehicle-logic";
import { formatCurrency, formatPercent } from "@/lib/utils";

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
    setVehicle(updated);
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
      <div className="space-y-4 text-center">
        <p className="text-slate-400">Vehicle not found.</p>
        <Button variant="outline" onClick={() => router.push("/inventory")}>
          Back to Inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/inventory"
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {getVehicleLabel(vehicle)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={vehicle.ai_priority} />
              <FbListingBadge status={vehicle.fb_listing_status} />
              {vehicle.fb_listing_url && (
                <a
                  href={vehicle.fb_listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-orange-500 hover:underline"
                >
                  View FB Listing <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="text-sm text-slate-400">
                {vehicle.status} · {vehicle.days_in_stock ?? 0} days in stock
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FbPublishDialog vehicle={vehicle} onPublished={loadData} />
          <Button
            variant={editing ? "secondary" : "outline"}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel Edit" : "Edit Vehicle"}
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleForm
              initialData={vehicle}
              onSubmit={handleUpdate}
              submitLabel="Save Changes"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Total Invested</p>
              <p className="text-xl font-bold">
                {formatCurrency(vehicle.total_invested)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Retail Price</p>
              <p className="text-xl font-bold">
                {formatCurrency(vehicle.retail_price)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Net Profit</p>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(vehicle.net_profit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">ROI</p>
              <p className="text-xl font-bold">{formatPercent(vehicle.roi)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!editing && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="VIN" value={vehicle.vin} />
              <DetailRow
                label="Mileage"
                value={
                  vehicle.mileage
                    ? `${vehicle.mileage.toLocaleString()} mi`
                    : null
                }
              />
              <DetailRow
                label="My Cost"
                value={formatCurrency(vehicle.my_cost)}
              />
              <DetailRow
                label="Repair Cost"
                value={formatCurrency(vehicle.repair_cost)}
              />
              <DetailRow
                label="Recommended Price"
                value={formatCurrency(vehicle.recommended_price)}
              />
              <DetailRow
                label="Listed Online"
                value={vehicle.listed_online ? "Yes" : "No"}
              />
              <DetailRow label="Channel" value={vehicle.online_channel} />
              <DetailRow
                label="Facebook Listing"
                value={
                  vehicle.fb_listing_url ? (
                    <a
                      href={vehicle.fb_listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:underline"
                    >
                      {vehicle.fb_listing_status ?? "published"}
                    </a>
                  ) : (
                    vehicle.fb_listing_status ?? "Not listed"
                  )
                }
              />
              <DetailRow label="Bought Date" value={vehicle.bought_date} />
              <DetailRow label="Notes" value={vehicle.notes} />
            </CardContent>
          </Card>

          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="text-orange-500">AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-300">
                {generateAiSummary(vehicle)}
              </p>
              <p className="mt-4 text-sm font-medium text-orange-400">
                Action: {vehicle.action_required}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Market Comps</CardTitle>
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
        </CardHeader>
        <CardContent>
          {vehicle.market_avg && (
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <span>
                Market Low:{" "}
                <strong>{formatCurrency(vehicle.market_low)}</strong>
              </span>
              <span>
                Market Avg:{" "}
                <strong>{formatCurrency(vehicle.market_avg)}</strong>
              </span>
              <span>
                Market High:{" "}
                <strong>{formatCurrency(vehicle.market_high)}</strong>
              </span>
              <span>
                Comps: <strong>{vehicle.comp_count ?? comps.length}</strong>
              </span>
            </div>
          )}

          {comps.length === 0 ? (
            <p className="py-4 text-center text-slate-400">
              No market comps yet. Add competitor listings to improve pricing.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell>{comp.source}</TableCell>
                    <TableCell>
                      {formatCurrency(comp.listing_price)}
                    </TableCell>
                    <TableCell>
                      {comp.mileage
                        ? `${comp.mileage.toLocaleString()} mi`
                        : "—"}
                    </TableCell>
                    <TableCell>{comp.location ?? "—"}</TableCell>
                    <TableCell>
                      {comp.url ? (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                        >
                          Link <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{comp.date_checked ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-200">{value ?? "—"}</span>
    </div>
  );
}
