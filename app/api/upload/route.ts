import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/lib/session";
import { processZip, ZipValidationError } from "@/lib/zip";
import { saveTempZip } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 uploads per minute per user.
  const rl = checkRateLimit(`upload:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many uploads. Please slow down." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isZip =
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip");
  if (!isZip) {
    return NextResponse.json(
      { error: "Only .zip files are accepted" },
      { status: 400 }
    );
  }

  if (file.size > config.maxUploadBytes) {
    return NextResponse.json(
      { error: `File exceeds the ${config.maxUploadBytes} byte limit` },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let processed;
  try {
    processed = processZip(bytes);
  } catch (err) {
    if (err instanceof ZipValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to read ZIP archive" },
      { status: 400 }
    );
  }

  const upload = await prisma.upload.create({
    data: {
      userId,
      zipName: file.name,
      sizeBytes: file.size,
      fileCount: processed.fileCount,
      status: "VALIDATED",
      fileTree: JSON.stringify(processed.tree),
    },
  });

  await saveTempZip(upload.id, bytes);

  return NextResponse.json({
    uploadId: upload.id,
    zipName: upload.zipName,
    fileCount: processed.fileCount,
    totalBytes: processed.totalBytes,
    tree: processed.tree,
    warnings: processed.warnings,
  });
}
