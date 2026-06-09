"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Vehicle } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface FbPublishDialogProps {
  vehicle: Vehicle;
  onPublished?: () => void;
}

export function FbPublishDialog({ vehicle, onPublished }: FbPublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setError(null);
    setSuccessUrl(null);

    try {
      const res = await fetch("/api/fb-listing-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicle.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate listing");
        return;
      }

      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setPrice(String(data.price ?? vehicle.retail_price ?? ""));
    } catch (err) {
      console.error(err);
      setError("Failed to generate listing content");
    } finally {
      setLoadingPreview(false);
    }
  }, [vehicle.id, vehicle.retail_price]);

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open, loadPreview]);

  const addPhoto = () => {
    if (newPhotoUrl.trim()) {
      setPhotos((prev) => [...prev.filter(Boolean), newPhotoUrl.trim()]);
      setNewPhotoUrl("");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch("/api/fb-publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          title,
          description,
          price: parseFloat(price),
          photos: photos.filter(Boolean),
          location,
          category: "vehicles",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Publishing failed");
        return;
      }

      setSuccessUrl(data.listing_url);
      onPublished?.();
    } catch (err) {
      console.error(err);
      setError("Network error while publishing. Is Multilogin running?");
    } finally {
      setPublishing(false);
    }
  };

  const validPhotos = photos.filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Share2 className="h-4 w-4" />
          Publish to Facebook Marketplace
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to Facebook Marketplace</DialogTitle>
          <DialogDescription>
            Review and edit the listing before publishing via Multilogin.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="text-slate-400">Generating listing with AI...</p>
          </div>
        ) : successUrl ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-300">
              Successfully published to Facebook Marketplace!
            </div>
            <a
              href={successUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-orange-500 hover:underline"
            >
              View live listing
              <ExternalLink className="h-4 w-4" />
            </a>
            <Button onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fb-title">Title</Label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-price">Price</Label>
              <Input
                id="fb-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-description">Description</Label>
              <Textarea
                id="fb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={5}
              />
              <p className="text-xs text-slate-500">
                {description.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-location">Location (Zip Code)</Label>
              <Input
                id="fb-location"
                placeholder="90210"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input value="Vehicles" disabled />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              {validPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {validPhotos.map((url, i) => (
                    <div key={url + i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="h-20 w-full rounded-md object-cover border border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No photos added yet.</p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/photo.jpg"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addPhoto}>
                  Add
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm">
              <p className="font-medium text-slate-300">Preview Summary</p>
              <p className="mt-2 text-slate-400">
                {title || "—"} · {formatCurrency(price ? parseFloat(price) : null)}
              </p>
              <p className="mt-1 line-clamp-3 text-slate-500">{description}</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              onClick={handlePublish}
              disabled={publishing || !title || !description || !price}
              className="w-full"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing to Facebook...
                </>
              ) : (
                "Confirm & Publish"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
