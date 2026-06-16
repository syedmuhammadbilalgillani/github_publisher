import { unzipSync } from "fflate";
import path from "node:path";
import { BLOCKED_EXTENSIONS, config } from "./config";

export interface ExtractedFile {
  /** POSIX-style relative path inside the archive. */
  path: string;
  content: Uint8Array;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileTreeNode[];
}

export interface ProcessedZip {
  files: ExtractedFile[];
  fileCount: number;
  totalBytes: number;
  tree: FileTreeNode[];
  warnings: string[];
}

export class ZipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipValidationError";
  }
}

/** Normalize and reject any path that attempts traversal or is absolute. */
function safeRelativePath(raw: string): string {
  // ZIP entries use forward slashes; normalize and strip leading slashes.
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  // Reject absolute paths and Windows drive letters.
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new ZipValidationError(`Absolute path not allowed: ${raw}`);
  }
  // Resolve against a virtual root and ensure it stays within it.
  const resolved = path.posix.normalize("/" + normalized);
  if (resolved.includes("/../") || resolved.startsWith("../")) {
    throw new ZipValidationError(`Path traversal detected: ${raw}`);
  }
  const clean = resolved.replace(/^\/+/, "");
  if (clean.split("/").some((seg) => seg === "..")) {
    throw new ZipValidationError(`Path traversal detected: ${raw}`);
  }
  return clean;
}

/** Build a nested tree from a flat list of file paths. */
function buildTree(files: ExtractedFile[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let cursor = root;
    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const currentPath = segments.slice(0, index + 1).join("/");
      cursor.children ??= [];
      let next = cursor.children.find((c) => c.name === segment);
      if (!next) {
        next = {
          name: segment,
          path: currentPath,
          type: isLeaf ? "file" : "dir",
          ...(isLeaf
            ? { size: file.content.length }
            : { children: [] }),
        };
        cursor.children.push(next);
      }
      cursor = next;
    });
  }

  // Sort: directories first, then alphabetical.
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.children) sortNodes(n.children);
    return nodes;
  };

  return sortNodes(root.children ?? []);
}

/**
 * Extracts and validates a ZIP archive entirely in memory.
 * Throws {@link ZipValidationError} on any security or limit violation.
 */
export function processZip(buffer: Uint8Array): ProcessedZip {
  if (buffer.length > config.maxUploadBytes) {
    throw new ZipValidationError(
      `ZIP exceeds maximum size of ${config.maxUploadBytes} bytes`
    );
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer);
  } catch {
    throw new ZipValidationError("File is not a valid ZIP archive");
  }

  const files: ExtractedFile[] = [];
  const warnings: string[] = [];
  let totalBytes = 0;

  for (const [rawPath, content] of Object.entries(entries)) {
    // Skip directory entries (zero-length, trailing slash).
    if (rawPath.endsWith("/")) continue;

    const cleanPath = safeRelativePath(rawPath);
    if (!cleanPath) continue;

    // Skip macOS resource-fork noise but warn once.
    if (
      cleanPath.startsWith("__MACOSX/") ||
      cleanPath.split("/").includes(".DS_Store")
    ) {
      warnings.push(`Skipped system file: ${cleanPath}`);
      continue;
    }

    const ext = path.posix.extname(cleanPath).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new ZipValidationError(
        `Blocked executable file type "${ext}" in ${cleanPath}`
      );
    }

    // Warn about hidden files (dotfiles) but allow them.
    const base = path.posix.basename(cleanPath);
    if (base.startsWith(".") && base !== ".gitignore" && base !== ".env.example") {
      warnings.push(`Hidden file included: ${cleanPath}`);
    }

    totalBytes += content.length;
    if (totalBytes > config.maxUncompressedBytes) {
      throw new ZipValidationError(
        "Uncompressed contents exceed allowed size (possible ZIP bomb)"
      );
    }

    files.push({ path: cleanPath, content });
    if (files.length > config.maxFileCount) {
      throw new ZipValidationError(
        `Archive exceeds maximum of ${config.maxFileCount} files`
      );
    }
  }

  if (files.length === 0) {
    throw new ZipValidationError("ZIP archive contains no usable files");
  }

  return {
    files,
    fileCount: files.length,
    totalBytes,
    tree: buildTree(files),
    warnings,
  };
}
