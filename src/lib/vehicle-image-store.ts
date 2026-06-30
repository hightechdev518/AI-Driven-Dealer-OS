import { promises as fs } from "fs";
import path from "path";
import {
  getVehicleImages,
  normalizeGalleryUrls,
  withSyncedVehicleImages,
} from "@/lib/vehicle-images";

const STORE_FILE = path.join(process.cwd(), "data", "vehicle-image-urls.json");

export type StoredVehicleImages = {
  urls: string[];
  cover: string | null;
};

type StoreValue = string | string[] | StoredVehicleImages;

async function readStore(): Promise<Record<string, StoreValue>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoreValue>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, StoreValue>) {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function parseStoreValue(value: StoreValue | undefined): StoredVehicleImages | null {
  if (!value) return null;

  if (typeof value === "string") {
    const url = value.trim();
    return url ? { urls: [url], cover: url } : null;
  }

  if (Array.isArray(value)) {
    const urls = value.filter(
      (url) => typeof url === "string" && url.trim().length > 0
    );
    return urls.length > 0 ? { urls, cover: urls[0] ?? null } : null;
  }

  const urls = normalizeGalleryUrls(value.urls);
  const cover = value.cover?.trim() || null;

  if (urls.length === 0) return null;

  return {
    urls,
    cover: cover && urls.includes(cover) ? cover : urls[0] ?? null,
  };
}

export async function getStoredVehicleImagesRecord(
  vehicleId: string
): Promise<StoredVehicleImages | null> {
  const store = await readStore();
  return parseStoreValue(store[vehicleId]);
}

export async function getStoredVehicleImages(
  vehicleId: string
): Promise<string[] | null> {
  const stored = await getStoredVehicleImagesRecord(vehicleId);
  return stored?.urls.length ? stored.urls : null;
}

export async function getStoredVehicleImageUrl(
  vehicleId: string
): Promise<string | null> {
  const stored = await getStoredVehicleImagesRecord(vehicleId);
  return stored?.cover ?? stored?.urls[0] ?? null;
}

export async function setStoredVehicleImages(
  vehicleId: string,
  imageUrls: string[] | null | undefined,
  coverUrl?: string | null
) {
  const store = await readStore();
  const urls = normalizeGalleryUrls(imageUrls);
  const cover = coverUrl?.trim() || null;

  if (urls.length > 0) {
    store[vehicleId] = {
      urls,
      cover: cover && urls.includes(cover) ? cover : urls.length === 1 ? urls[0]! : cover,
    };
  } else {
    delete store[vehicleId];
  }

  await writeStore(store);
}

export async function setStoredVehicleImageUrl(
  vehicleId: string,
  imageUrl: string | null | undefined
) {
  await setStoredVehicleImages(
    vehicleId,
    imageUrl?.trim() ? [imageUrl.trim()] : null,
    imageUrl?.trim() ?? null
  );
}

export function isMissingImageColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST204" &&
    typeof err.message === "string" &&
    (err.message.includes("image_url") || err.message.includes("image_urls"))
  );
}

export function isMissingImageUrlColumn(error: unknown): boolean {
  return isMissingImageColumn(error);
}

export function attachStoredImages<
  T extends {
    id: string;
    image_url?: string | null;
    image_urls?: string[] | null;
  },
>(vehicle: T, stored: StoredVehicleImages | null): T {
  const current = getVehicleImages(vehicle);
  if (current.length > 0) return vehicle;
  if (!stored?.urls.length) return vehicle;

  return {
    ...vehicle,
    ...withSyncedVehicleImages({
      image_urls: stored.urls,
      image_url: stored.cover,
    }),
  };
}

export function attachStoredImageUrl<
  T extends {
    id: string;
    image_url?: string | null;
    image_urls?: string[] | null;
  },
>(vehicle: T, storedUrl: string | null): T {
  return attachStoredImages(
    vehicle,
    storedUrl ? { urls: [storedUrl], cover: storedUrl } : null
  );
}

export async function attachStoredImageUrls<
  T extends {
    id: string;
    image_url?: string | null;
    image_urls?: string[] | null;
  },
>(vehicles: T[]): Promise<T[]> {
  const store = await readStore();

  return vehicles.map((vehicle) =>
    attachStoredImages(vehicle, parseStoreValue(store[vehicle.id]))
  );
}
