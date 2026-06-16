"use client";

import { useState } from "react";
import { Folder, FolderOpen, File as FileIcon, ChevronRight } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileTreeNode[];
}

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);

  if (node.type === "file") {
    return (
      <div
        className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <span className="flex items-center gap-2 truncate">
          <FileIcon className="size-4 shrink-0 text-zinc-400" />
          {node.name}
        </span>
        {typeof node.size === "number" && (
          <span className="text-xs text-zinc-400">{formatBytes(node.size)}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="size-4 shrink-0 text-amber-500" />
        )}
        {node.name}
      </button>
      {open &&
        node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function FileTree({ nodes }: { nodes: FileTreeNode[] }) {
  return (
    <div className="max-h-96 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
