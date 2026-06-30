export function normalizeGalleryUrls(image_urls?: string[] | null): string[] {
  return (image_urls ?? []).filter(
    (url): url is string => typeof url === "string" && url.trim().length > 0
  );
}

export function normalizeImageUrls(
  image_urls?: string[] | null,
  image_url?: string | null
): string[] {
  const gallery = normalizeGalleryUrls(image_urls);
  if (gallery.length > 0) return gallery;
  if (image_url?.trim()) return [image_url.trim()];
  return [];
}

export function getVehicleCoverImage(vehicle: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string | null {
  const cover = vehicle.image_url?.trim();
  if (cover) return cover;

  const gallery = normalizeGalleryUrls(vehicle.image_urls);
  return gallery[0] ?? null;
}

export function withSyncedVehicleImages<
  T extends { image_url?: string | null; image_urls?: string[] | null },
>(data: T): T & { image_urls: string[]; image_url: string | null } {
  const gallery = normalizeGalleryUrls(data.image_urls);
  let cover = data.image_url?.trim() || null;

  if (gallery.length === 0) {
    return {
      ...data,
      image_urls: cover ? [cover] : [],
      image_url: cover,
    };
  }

  if (cover && !gallery.includes(cover)) {
    cover = null;
  }

  if (gallery.length === 1) {
    cover = gallery[0] ?? null;
  }

  return {
    ...data,
    image_urls: gallery,
    image_url: cover,
  };
}

export function getVehicleImages(vehicle: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string[] {
  return normalizeImageUrls(vehicle.image_urls, vehicle.image_url);
}

export function getCoverImageIndex(
  images: string[],
  coverUrl?: string | null
): number {
  if (!coverUrl) return 0;
  const index = images.indexOf(coverUrl);
  return index >= 0 ? index : 0;
}
