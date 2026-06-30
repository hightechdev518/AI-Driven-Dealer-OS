import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import {
  BUCKET,
  createAdminClient,
  ensureVehicleImagesBucket,
} from "@/lib/supabase/admin";
import {
  primaryVehicleUploadDir,
  vehicleUploadPublicPath,
} from "@/lib/vehicle-upload-paths";

async function uploadToSupabase(
  client: ReturnType<typeof createServerClient>,
  objectPath: string,
  buffer: Buffer,
  contentType: string
) {
  return client.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });
}

async function saveLocalUpload(buffer: Buffer, ext: string): Promise<string> {
  const dir = primaryVehicleUploadDir();
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(`${dir}/${filename}`, buffer);

  return vehicleUploadPublicPath(filename);
}

export async function uploadVehicleImage(
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; storage: "supabase" | "local" }> {
  const objectPath = `${randomUUID()}.${ext}`;
  const supabase = createServerClient();

  let { error: uploadError } = await uploadToSupabase(
    supabase,
    objectPath,
    buffer,
    contentType
  );

  const bucketMissing =
    uploadError?.message?.toLowerCase().includes("bucket not found") ||
    uploadError?.message?.toLowerCase().includes("not found");

  if (bucketMissing) {
    const admin = createAdminClient();

    if (admin) {
      try {
        await ensureVehicleImagesBucket(admin);
        const retry = await uploadToSupabase(admin, objectPath, buffer, contentType);
        uploadError = retry.error;
      } catch (adminError) {
        console.error("Failed to ensure vehicle-images bucket:", adminError);
      }
    }
  }

  if (!uploadError) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: "supabase" };
  }

  console.warn(
    "Supabase upload unavailable, using local storage fallback:",
    uploadError.message
  );

  const localUrl = await saveLocalUpload(buffer, ext);
  return { url: localUrl, storage: "local" };
}
