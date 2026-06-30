import { promises as fs } from "fs";
import path from "path";

const STORE_FILE = path.join(process.cwd(), "data", "vehicle-image-urls.json");

async function readStore(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, string>) {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getStoredVehicleImageUrl(
  vehicleId: string
): Promise<string | null> {
  const store = await readStore();
  return store[vehicleId] ?? null;
}

export async function setStoredVehicleImageUrl(
  vehicleId: string,
  imageUrl: string | null | undefined
) {
  const store = await readStore();
  if (imageUrl?.trim()) {
    store[vehicleId] = imageUrl.trim();
  } else {
    delete store[vehicleId];
  }
  await writeStore(store);
}

export function isMissingImageUrlColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST204" &&
    typeof err.message === "string" &&
    err.message.includes("image_url")
  );
}

export function attachStoredImageUrl<
  T extends { id: string; image_url?: string | null },
>(vehicle: T, storedUrl: string | null): T {
  if (vehicle.image_url?.trim()) return vehicle;
  if (!storedUrl) return vehicle;
  return { ...vehicle, image_url: storedUrl };
}

export async function attachStoredImageUrls<
  T extends { id: string; image_url?: string | null },
>(vehicles: T[]): Promise<T[]> {
  const store = await readStore();
  return vehicles.map((vehicle) =>
    attachStoredImageUrl(vehicle, store[vehicle.id] ?? null)
  );
}
