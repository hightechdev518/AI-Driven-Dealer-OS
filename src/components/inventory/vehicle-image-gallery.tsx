"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Camera, Car, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { getCoverImageIndex } from "@/lib/vehicle-images";
import { cn } from "@/lib/utils";

interface VehicleImageGalleryProps {
  images: string[];
  coverUrl?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}

export function VehicleImageGallery({
  images,
  coverUrl,
  alt,
  className,
  imageClassName,
  children,
}: VehicleImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setActiveIndex(getCoverImageIndex(images, coverUrl));
    setFailed({});
  }, [images, coverUrl]);

  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

  const currentUrl = images[activeIndex];
  const hasMultiple = images.length > 1;
  const showImage = currentUrl && !failed[activeIndex];

  const goPrev = () => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  };

  const goNext = () => {
    setActiveIndex((index) => (index + 1) % images.length);
  };

  return (
    <div className={className}>
      <div className="relative aspect-[21/9] min-h-[200px] w-full overflow-hidden sm:aspect-[2/1]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentUrl}
            src={currentUrl}
            alt={alt}
            className={cn(
              "h-full w-full object-cover brightness-[1.3]",
              imageClassName
            )}
            onError={() =>
              setFailed((prev) => ({ ...prev, [activeIndex]: true }))
            }
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-[#0b0e14]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.08)_0%,_transparent_70%)]" />
            <Car className="h-16 w-16 text-slate-600/80" strokeWidth={1.25} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0e14]/95 via-[#0b0e14]/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute right-4 top-[4.5rem] z-10 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/10 backdrop-blur-md">
              <Camera className="h-3 w-3 opacity-80" />
              {activeIndex + 1}/{images.length}
            </span>
          </>
        )}

        {children}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
          {images.map((url, index) => {
            const isCover = url === coverUrl;

            return (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1}`}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                index === activeIndex
                  ? "border-cyan-400 opacity-100 ring-1 ring-cyan-400/40"
                  : "border-white/10 opacity-70 hover:border-white/25 hover:opacity-100",
                isCover && index !== activeIndex && "border-cyan-400/50"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
              />
              {isCover && (
                <span className="absolute bottom-1 left-1 rounded-full bg-cyan-500 p-0.5 text-slate-900">
                  <Star className="h-2.5 w-2.5 fill-current" />
                </span>
              )}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
