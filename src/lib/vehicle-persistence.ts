import type { PostgrestError } from "@supabase/supabase-js";
import type { Vehicle, VehicleFormData } from "@/lib/types";
import { withSyncedVehicleImages } from "@/lib/vehicle-images";
import { enrichVehicle } from "@/lib/vehicle-logic";
import {
  isMissingImageColumn,
  setStoredVehicleImages,
} from "@/lib/vehicle-image-store";

type EnrichedVehicle = ReturnType<typeof enrichVehicle>;

export async function saveVehicleWithOptionalImage({
  vehicleId,
  enriched,
  imageUrls,
  coverUrl,
  save,
}: {
  vehicleId: string;
  enriched: EnrichedVehicle;
  imageUrls: string[];
  coverUrl?: string | null;
  save: (
    payload: EnrichedVehicle
  ) => PromiseLike<{ data: Vehicle | null; error: PostgrestError | null }>;
}): Promise<{ data: Vehicle | null; error: PostgrestError | null }> {
  const firstAttempt = await save(enriched);

  if (!firstAttempt.error) {
    if (imageUrls.length > 0) {
      await setStoredVehicleImages(vehicleId, null);
    }
    return firstAttempt;
  }

  if (!isMissingImageColumn(firstAttempt.error)) {
    return firstAttempt;
  }

  if (imageUrls.length > 0) {
    await setStoredVehicleImages(vehicleId, imageUrls, coverUrl);
  }

  const { image_url, image_urls, ...withoutImages } = enriched;
  void image_url;
  void image_urls;

  return save(withoutImages as EnrichedVehicle);
}

export function extractVehicleImages(body: VehicleFormData): {
  imageUrls: string[];
  coverUrl: string | null;
} {
  const synced = withSyncedVehicleImages(body);
  return {
    imageUrls: synced.image_urls,
    coverUrl: synced.image_url,
  };
}

export function extractImageUrl(body: VehicleFormData): string | null | undefined {
  return withSyncedVehicleImages(body).image_url;
}
