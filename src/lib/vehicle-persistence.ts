import type { PostgrestError } from "@supabase/supabase-js";
import type { Vehicle, VehicleFormData } from "@/lib/types";
import { enrichVehicle } from "@/lib/vehicle-logic";
import {
  isMissingImageUrlColumn,
  setStoredVehicleImageUrl,
} from "@/lib/vehicle-image-store";

type EnrichedVehicle = ReturnType<typeof enrichVehicle>;

export async function saveVehicleWithOptionalImage({
  vehicleId,
  enriched,
  imageUrl,
  save,
}: {
  vehicleId: string;
  enriched: EnrichedVehicle;
  imageUrl?: string | null;
  save: (
    payload: EnrichedVehicle
  ) => PromiseLike<{ data: Vehicle | null; error: PostgrestError | null }>;
}): Promise<{ data: Vehicle | null; error: PostgrestError | null }> {
  const firstAttempt = await save(enriched);

  if (!firstAttempt.error) {
    if (imageUrl?.trim()) {
      await setStoredVehicleImageUrl(vehicleId, null);
    }
    return firstAttempt;
  }

  if (!isMissingImageUrlColumn(firstAttempt.error) || !("image_url" in enriched)) {
    return firstAttempt;
  }

  const fallbackUrl = imageUrl ?? enriched.image_url ?? null;
  if (fallbackUrl) {
    await setStoredVehicleImageUrl(vehicleId, fallbackUrl);
  }

  const { image_url, ...withoutImageUrl } = enriched;
  void image_url;
  return save(withoutImageUrl as EnrichedVehicle);
}

export function extractImageUrl(body: VehicleFormData): string | null | undefined {
  return body.image_url;
}
