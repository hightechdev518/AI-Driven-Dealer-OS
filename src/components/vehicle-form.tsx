"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VehicleImagesUpload } from "@/components/vehicle-images-upload";
import { withSyncedVehicleImages } from "@/lib/vehicle-images";
import type { VehicleFormData } from "@/lib/types";

interface VehicleFormProps {
  initialData?: VehicleFormData;
  onSubmit: (data: VehicleFormData) => Promise<void>;
  onImagesChange?: (data: {
    image_urls: string[];
    image_url: string | null;
  }) => void;
  submitLabel?: string;
}

const emptyForm: VehicleFormData = {
  year: null,
  make: "",
  model: "",
  mileage: null,
  vin: "",
  my_cost: null,
  repair_cost: null,
  retail_price: null,
  listed_online: false,
  online_channel: "",
  status: "In Stock",
  bought_date: new Date().toISOString().split("T")[0],
  notes: "",
  image_url: null,
  image_urls: [],
};

export function VehicleForm({
  initialData,
  onSubmit,
  onImagesChange,
  submitLabel = "Save Vehicle",
}: VehicleFormProps) {
  const [form, setForm] = useState<VehicleFormData>(() =>
    withSyncedVehicleImages({
      ...emptyForm,
      ...initialData,
    })
  );
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const gallery =
    form.image_urls ?? (form.image_url ? [form.image_url] : []);
  const coverUrl = form.image_url ?? null;

  const syncImages = (image_urls: string[], image_url: string | null) => {
    const synced = withSyncedVehicleImages({ ...form, image_urls, image_url });
    setForm((prev) => ({
      ...prev,
      image_urls: synced.image_urls,
      image_url: synced.image_url,
    }));
    onImagesChange?.({
      image_urls: synced.image_urls,
      image_url: synced.image_url,
    });
  };

  const update = (key: keyof VehicleFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const synced = withSyncedVehicleImages(form);
    if (synced.image_urls.length > 1 && !synced.image_url) {
      setFormError("Choose a cover photo before saving.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(synced);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <VehicleImagesUpload
        images={gallery}
        coverUrl={coverUrl}
        onImagesChange={(image_urls) => syncImages(image_urls, coverUrl)}
        onCoverChange={(image_url) => syncImages(gallery, image_url)}
      />

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            value={form.year ?? ""}
            onChange={(e) =>
              update("year", e.target.value ? parseInt(e.target.value) : null)
            }
          />
        </div>
        <div>
          <Label htmlFor="make">Make</Label>
          <Input
            id="make"
            value={form.make ?? ""}
            onChange={(e) => update("make", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={form.model ?? ""}
            onChange={(e) => update("model", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="mileage">Mileage</Label>
          <Input
            id="mileage"
            type="number"
            value={form.mileage ?? ""}
            onChange={(e) =>
              update("mileage", e.target.value ? parseInt(e.target.value) : null)
            }
          />
        </div>
        <div>
          <Label htmlFor="vin">VIN</Label>
          <Input
            id="vin"
            value={form.vin ?? ""}
            onChange={(e) => update("vin", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="my_cost">My Cost ($)</Label>
          <Input
            id="my_cost"
            type="number"
            value={form.my_cost ?? ""}
            onChange={(e) =>
              update("my_cost", e.target.value ? parseFloat(e.target.value) : null)
            }
          />
        </div>
        <div>
          <Label htmlFor="repair_cost">Repair Cost ($)</Label>
          <Input
            id="repair_cost"
            type="number"
            value={form.repair_cost ?? ""}
            onChange={(e) =>
              update(
                "repair_cost",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
        <div>
          <Label htmlFor="retail_price">Retail Price ($)</Label>
          <Input
            id="retail_price"
            type="number"
            value={form.retail_price ?? ""}
            onChange={(e) =>
              update(
                "retail_price",
                e.target.value ? parseFloat(e.target.value) : null
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bought_date">Bought Date</Label>
          <Input
            id="bought_date"
            type="date"
            value={form.bought_date ?? ""}
            onChange={(e) => update("bought_date", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="online_channel">Online Channel</Label>
          <Input
            id="online_channel"
            placeholder="Facebook, Cars.com, etc."
            value={form.online_channel ?? ""}
            onChange={(e) => update("online_channel", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Input
            id="status"
            value={form.status ?? ""}
            onChange={(e) => update("status", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="listed_online"
          type="checkbox"
          checked={form.listed_online ?? false}
          onChange={(e) => update("listed_online", e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-orange-500"
        />
        <Label htmlFor="listed_online">Listed Online</Label>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
