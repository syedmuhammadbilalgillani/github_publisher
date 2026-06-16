// Centralized, validated configuration derived from environment variables.

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  /** Max accepted ZIP size in bytes. */
  maxUploadBytes: intFromEnv("MAX_UPLOAD_BYTES", 50 * 1024 * 1024),
  /** Max number of entries allowed inside a ZIP. */
  maxFileCount: intFromEnv("MAX_FILE_COUNT", 5000),
  /** Max total uncompressed size (ZIP-bomb guard). */
  maxUncompressedBytes: intFromEnv(
    "MAX_UNCOMPRESSED_BYTES",
    500 * 1024 * 1024
  ),
};

// File extensions considered dangerous/executable and rejected on upload.
export const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".vbs",
  ".vbe",
  ".jar",
  ".app",
  ".deb",
  ".rpm",
  ".bin",
]);
