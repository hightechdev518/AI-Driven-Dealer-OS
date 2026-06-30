import { access, readFile } from "fs/promises";
import { NextResponse } from "next/server";
import {
  contentTypeForUpload,
  getVehicleUploadDirs,
  isSafeUploadFilename,
  resolveUploadFilePath,
} from "@/lib/vehicle-upload-paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;

  if (!isSafeUploadFilename(filename)) {
    return new NextResponse(null, { status: 404 });
  }

  for (const dir of getVehicleUploadDirs()) {
    const filePath = resolveUploadFilePath(filename, dir);
    if (!filePath) continue;

    try {
      await access(filePath);
      const buffer = await readFile(filePath);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentTypeForUpload(filename),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      continue;
    }
  }

  return new NextResponse(null, { status: 404 });
}
