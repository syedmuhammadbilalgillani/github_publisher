import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Temporary storage for uploaded ZIP archives between the upload and publish
// steps of the wizard. This uses the OS temp directory, which is suitable for
// a single long-running server (Docker/VPS). For serverless/multi-instance
// deployments, replace this with object storage (S3, Cloudinary, UploadThing).

const TMP_DIR = path.join(os.tmpdir(), "gh-zip-publisher");

function pathFor(uploadId: string): string {
  // uploadId is a server-generated cuid, but guard against traversal anyway.
  const safe = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(TMP_DIR, `${safe}.zip`);
}

export async function saveTempZip(
  uploadId: string,
  bytes: Uint8Array
): Promise<void> {
  await mkdir(TMP_DIR, { recursive: true });
  await writeFile(pathFor(uploadId), bytes);
}

export async function readTempZip(uploadId: string): Promise<Uint8Array> {
  return readFile(pathFor(uploadId));
}

export async function deleteTempZip(uploadId: string): Promise<void> {
  try {
    await unlink(pathFor(uploadId));
  } catch {
    // already gone — ignore
  }
}
