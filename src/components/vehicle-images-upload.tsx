"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface VehicleImagesUploadProps {
  images: string[];
  coverUrl: string | null;
  onImagesChange: (urls: string[]) => void;
  onCoverChange: (url: string | null) => void;
  className?: string;
}

export function VehicleImagesUpload({
  images,
  coverUrl,
  onImagesChange,
  onCoverChange,
  className,
}: VehicleImagesUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/vehicles/upload-photo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url as string;
  };

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);

    try {
      const uploaded: string[] = [];

      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file));
      }

      const nextImages = [...images, ...uploaded];
      onImagesChange(nextImages);

      if (!coverUrl && uploaded.length === 1 && nextImages.length === 1) {
        onCoverChange(uploaded[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    const removed = images[index];
    const nextImages = images.filter((_, i) => i !== index);
    onImagesChange(nextImages);

    if (removed && removed === coverUrl) {
      onCoverChange(nextImages.length === 1 ? (nextImages[0] ?? null) : null);
    }
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const nextImages = [...images, trimmed];
    onImagesChange(nextImages);

    if (!coverUrl && nextImages.length === 1) {
      onCoverChange(trimmed);
    }

    setUrlInput("");
  };

  const needsCoverSelection = images.length > 1 && !coverUrl;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>Vehicle Photos</Label>
        <p className="mt-1 text-xs text-slate-400">
          Upload multiple photos, then choose one as the cover image for inventory cards.
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, index) => {
            const isCover = url === coverUrl;

            return (
              <div
                key={`${url}-${index}`}
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-slate-900",
                  isCover ? "border-cyan-400 ring-1 ring-cyan-400/40" : "border-white/10"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Vehicle photo ${index + 1}`}
                  className="aspect-[16/10] w-full object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={() => removeAt(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                {isCover ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-900">
                    <Star className="h-3 w-3 fill-current" />
                    Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCoverChange(url)}
                    className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/80"
                  >
                    Set as cover
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {needsCoverSelection && (
        <p className="text-sm text-amber-400">
          Select a cover photo before saving.
        </p>
      )}

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-slate-900/50 text-muted-foreground transition-colors hover:border-white/25 hover:bg-slate-900"
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        ) : (
          <>
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm">
              {images.length > 0 ? "Add more photos" : "Click to upload photos"}
            </span>
            <span className="text-xs opacity-70">
              JPEG, PNG, WebP · max 5 MB each
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) void handleFiles(files);
        }}
      />

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Or paste image URL and press Add"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addUrl}>
          Add
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
