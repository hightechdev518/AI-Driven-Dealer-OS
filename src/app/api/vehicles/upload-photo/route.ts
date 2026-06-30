import { NextResponse } from "next/server";
import { uploadVehicleImage } from "@/lib/vehicle-upload";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 5 MB or smaller" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    const { url, storage } = await uploadVehicleImage(buffer, file.type, ext);

    return NextResponse.json({ url, storage });
  } catch (error) {
    console.error("POST /api/vehicles/upload-photo:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload image. Add SUPABASE_SERVICE_ROLE_KEY or use a photo URL.",
      },
      { status: 500 }
    );
  }
}
