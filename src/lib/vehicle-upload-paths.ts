import path from "path";

export const VEHICLE_UPLOAD_URL_PREFIX = "/uploads/vehicles";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function getVehicleUploadDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "uploads", "vehicles"),
    path.join(cwd, "public", "uploads", "vehicles"),
  ];
}

export function primaryVehicleUploadDir(): string {
  return getVehicleUploadDirs()[0]!;
}

export function vehicleUploadPublicPath(filename: string): string {
  return `${VEHICLE_UPLOAD_URL_PREFIX}/${filename}`;
}

export function isSafeUploadFilename(filename: string): boolean {
  return /^[\w-]+\.(jpe?g|png|webp|gif)$/i.test(filename);
}

export function contentTypeForUpload(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function resolveUploadFilePath(
  filename: string,
  dir: string
): string | null {
  const safe = path.basename(filename);
  if (!isSafeUploadFilename(safe)) return null;

  const root = path.resolve(dir);
  const full = path.resolve(root, safe);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) return null;

  return full;
}
