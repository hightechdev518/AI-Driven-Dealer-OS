"use client";

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { getVehicleCoverImage } from "@/lib/vehicle-images";

interface VehiclePhotoProps {
  vehicle: Vehicle;
  className?: string;
  overlay?: boolean;
}

export function VehiclePhoto({ vehicle, className, overlay }: VehiclePhotoProps) {
  const [failed, setFailed] = useState(false);
  const label = getVehicleLabel(vehicle);
  const imageUrl = getVehicleCoverImage(vehicle);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-[#0b0e14] ${className ?? ""}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.08)_0%,_transparent_70%)]" />
        <Car className="h-16 w-16 text-slate-600/80" strokeWidth={1.25} />
        {!overlay && (
          <span className="absolute bottom-4 left-4 right-4 text-center text-xs text-slate-500">
            {label}
          </span>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={imageUrl}
      src={imageUrl}
      alt={label}
      className={className ?? "h-full w-full object-cover"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
