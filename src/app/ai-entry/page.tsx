"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AiExtractedVehicle } from "@/lib/types";

const PLACEHOLDER =
  "2009 BMW M3, bought for $8000, 140k miles, needs new tires, listed on Facebook";

export default function AiEntryPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<AiExtractedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!description.trim()) return;

    setExtracting(true);
    setError(null);
    setExtracted(null);

    try {
      const res = await fetch("/api/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      setExtracted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...extracted,
          listed_online: !!extracted.online_channel,
          status: "In Stock",
          bought_date: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      router.push(`/inventory/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateExtracted = (key: keyof AiExtractedVehicle, value: unknown) => {
    if (!extracted) return;
    setExtracted({ ...extracted, [key]: value });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <Sparkles className="h-8 w-8 text-orange-500" />
          AI Entry
        </h1>
        <p className="mt-1 text-slate-400">
          Describe a vehicle in plain English — AI extracts the details for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Describe Your Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={PLACEHOLDER}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="text-base"
          />
          <Button
            onClick={handleExtract}
            disabled={extracting || !description.trim()}
            className="w-full sm:w-auto"
          >
            {extracting ? "Extracting..." : "Extract with AI"}
          </Button>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>

      {extracted && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="ext_year">Year</Label>
                <Input
                  id="ext_year"
                  type="number"
                  value={extracted.year ?? ""}
                  onChange={(e) =>
                    updateExtracted(
                      "year",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ext_make">Make</Label>
                <Input
                  id="ext_make"
                  value={extracted.make ?? ""}
                  onChange={(e) => updateExtracted("make", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ext_model">Model</Label>
                <Input
                  id="ext_model"
                  value={extracted.model ?? ""}
                  onChange={(e) => updateExtracted("model", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ext_mileage">Mileage</Label>
                <Input
                  id="ext_mileage"
                  type="number"
                  value={extracted.mileage ?? ""}
                  onChange={(e) =>
                    updateExtracted(
                      "mileage",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ext_channel">Online Channel</Label>
                <Input
                  id="ext_channel"
                  value={extracted.online_channel ?? ""}
                  onChange={(e) =>
                    updateExtracted("online_channel", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="ext_cost">My Cost ($)</Label>
                <Input
                  id="ext_cost"
                  type="number"
                  value={extracted.my_cost ?? ""}
                  onChange={(e) =>
                    updateExtracted(
                      "my_cost",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ext_repair">Repair Cost ($)</Label>
                <Input
                  id="ext_repair"
                  type="number"
                  value={extracted.repair_cost ?? ""}
                  onChange={(e) =>
                    updateExtracted(
                      "repair_cost",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ext_retail">Retail Price ($)</Label>
                <Input
                  id="ext_retail"
                  type="number"
                  value={extracted.retail_price ?? ""}
                  onChange={(e) =>
                    updateExtracted(
                      "retail_price",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ext_notes">Notes</Label>
              <Textarea
                id="ext_notes"
                value={extracted.notes ?? ""}
                onChange={(e) => updateExtracted("notes", e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Save to Inventory"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
