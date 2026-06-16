"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileArchive,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Lock,
  Globe,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileTree, type FileTreeNode } from "@/components/dashboard/file-tree";
import { cn, formatBytes } from "@/lib/utils";

interface UploadResult {
  uploadId: string;
  zipName: string;
  fileCount: number;
  totalBytes: number;
  tree: FileTreeNode[];
  warnings: string[];
}

interface Repo {
  id: number;
  name: string;
  fullName: string;
  visibility: string;
  private: boolean;
  defaultBranch: string;
}

type Mode = "create" | "existing";

interface PublishOutcome {
  commitHash: string;
  commitUrl: string;
  repoUrl: string;
  branch: string;
}

const STEPS = ["Upload", "Preview", "Repository", "Commit", "Publish"];

// Ordered publish states for the progress bar in step 5.
const PUBLISH_STATES = [
  "QUEUED",
  "EXTRACTING",
  "READING",
  "CREATING_REPO",
  "COMMITTING",
  "PUSHING",
  "COMPLETED",
];

export function UploadWizard() {
  const [step, setStep] = useState(1);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 2 / shared
  const [result, setResult] = useState<UploadResult | null>(null);

  // Step 3
  const [mode, setMode] = useState<Mode>("create");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivate, setNewPrivate] = useState(true);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  // Step 4
  const [branch, setBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("Initial project upload");

  // Step 5
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // --- Upload handling -----------------------------------------------------
  const handleFile = useCallback(async (selected: File) => {
    setUploadError(null);
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setUploadError("Please select a .zip file.");
      return;
    }
    setFile(selected);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data);
      // Pre-fill suggested repo name from the zip filename.
      setNewName(
        data.zipName
          .replace(/\.zip$/i, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "")
      );
      setStep(2);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setFile(null);
    } finally {
      setUploading(false);
    }
  }, []);

  // --- Load repos when entering step 3 in existing mode --------------------
  async function loadRepos() {
    setReposLoading(true);
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (res.ok) setRepos(data.repositories);
    } finally {
      setReposLoading(false);
    }
  }

  useEffect(() => {
    if (step === 3 && mode === "existing" && repos.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode]);

  // --- Publish (SSE stream) ------------------------------------------------
  async function startPublish() {
    if (!result) return;
    setPublishing(true);
    setPublishError(null);
    setOutcome(null);
    setPublishLog([]);
    setPublishStatus("QUEUED");

    const target =
      mode === "create"
        ? {
            mode: "create" as const,
            name: newName,
            description: newDesc || undefined,
            private: newPrivate,
          }
        : { mode: "existing" as const, fullName: selectedRepo };

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadId: result.uploadId,
          branch,
          commitMessage,
          target,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start publishing");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventMatch = chunk.match(/^event: (.+)$/m);
          const dataMatch = chunk.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "progress") {
            setPublishStatus(data.status);
            setPublishLog((log) => [...log, data.message]);
          } else if (event === "completed") {
            setPublishStatus("COMPLETED");
            setOutcome(data);
          } else if (event === "failed") {
            setPublishStatus("FAILED");
            setPublishError(data.error);
          }
        }
      }
    } catch (err) {
      setPublishStatus("FAILED");
      setPublishError(err instanceof Error ? err.message : "Publishing failed");
    } finally {
      setPublishing(false);
    }
  }

  const progressPct =
    publishStatus === "FAILED"
      ? 100
      : publishStatus
        ? ((PUBLISH_STATES.indexOf(publishStatus) + 1) /
            PUBLISH_STATES.length) *
          100
        : 0;

  const canPublish =
    mode === "create" ? newName.trim().length > 0 : selectedRepo.length > 0;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  n === step
                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : n < step
                      ? "bg-green-600 text-white"
                      : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
                )}
              >
                {n < step ? "✓" : n}
              </span>
              <span
                className={cn(
                  "hidden sm:block",
                  n === step ? "font-medium" : "text-zinc-500"
                )}
              >
                {label}
              </span>
              {n < STEPS.length && (
                <span className="mx-1 text-zinc-300 dark:text-zinc-700">/</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a ZIP archive</CardTitle>
            <CardDescription>
              Drag & drop a .zip of your project, or browse to select it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                dragging
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
              )}
            >
              {uploading ? (
                <Loader2 className="size-8 animate-spin text-zinc-400" />
              ) : (
                <UploadCloud className="size-8 text-zinc-400" />
              )}
              <div className="text-sm">
                {uploading ? (
                  "Uploading and validating…"
                ) : file ? (
                  <span className="flex items-center gap-2">
                    <FileArchive className="size-4" />
                    {file.name} ({formatBytes(file.size)})
                  </span>
                ) : (
                  <>
                    <span className="font-medium">Click to upload</span> or drag
                    and drop
                  </>
                )}
              </div>
              <span className="text-xs text-zinc-400">ZIP up to the configured limit</span>
              <input
                ref={inputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {uploadError && (
              <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <XCircle className="size-4" />
                {uploadError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview file tree</CardTitle>
            <CardDescription>
              {result.fileCount} files · {formatBytes(result.totalBytes)} ·{" "}
              {result.zipName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.warnings.length > 0 && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" />
                  {result.warnings.length} warning(s)
                </div>
                <ul className="ml-6 list-disc">
                  {result.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <FileTree nodes={result.tree} />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>Next: choose repository</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Repository */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select repository</CardTitle>
            <CardDescription>
              Create a new repository or publish into an existing one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={cn(
                  "flex-1 rounded-md border p-3 text-left text-sm",
                  mode === "create"
                    ? "border-zinc-900 dark:border-zinc-50"
                    : "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <div className="font-medium">Create new</div>
                <div className="text-xs text-zinc-500">
                  Make a brand new repository
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={cn(
                  "flex-1 rounded-md border p-3 text-left text-sm",
                  mode === "existing"
                    ? "border-zinc-900 dark:border-zinc-50"
                    : "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <div className="font-medium">Use existing</div>
                <div className="text-xs text-zinc-500">
                  Push into a repository you own
                </div>
              </button>
            </div>

            {mode === "create" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-name">Repository name</Label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my-project"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-desc">Description (optional)</Label>
                  <Textarea
                    id="new-desc"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={newPrivate}
                      onChange={() => setNewPrivate(true)}
                    />
                    <Lock className="size-3" /> Private
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!newPrivate}
                      onChange={() => setNewPrivate(false)}
                    />
                    <Globe className="size-3" /> Public
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {reposLoading ? (
                  <p className="text-sm text-zinc-500">Loading repositories…</p>
                ) : (
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {repos.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => setSelectedRepo(repo.fullName)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border p-2 text-left text-sm",
                          selectedRepo === repo.fullName
                            ? "border-zinc-900 dark:border-zinc-50"
                            : "border-zinc-200 dark:border-zinc-800"
                        )}
                      >
                        <span className="truncate">{repo.fullName}</span>
                        <Badge variant="outline">
                          {repo.private ? (
                            <Lock className="mr-1 size-3" />
                          ) : (
                            <Globe className="mr-1 size-3" />
                          )}
                          {repo.defaultBranch}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canPublish}>
                Next: configure commit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Commit */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure commit</CardTitle>
            <CardDescription>
              Set the target branch and commit message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commit">Commit message</Label>
              <Textarea
                id="commit"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  setStep(5);
                  startPublish();
                }}
              >
                Publish to GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Publish */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing</CardTitle>
            <CardDescription>
              Pushing your project to GitHub in real time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPct} />

            {outcome ? (
              <div className="rounded-md bg-green-50 p-4 text-sm dark:bg-green-900/20">
                <div className="mb-2 flex items-center gap-2 font-medium text-green-800 dark:text-green-300">
                  <CheckCircle2 className="size-5" />
                  Published successfully!
                </div>
                <dl className="space-y-1 text-zinc-700 dark:text-zinc-300">
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Branch:</dt>
                    <dd>{outcome.branch}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Commit:</dt>
                    <dd className="font-mono">{outcome.commitHash.slice(0, 10)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm">
                    <a href={outcome.repoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" /> Open repository
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={outcome.commitUrl} target="_blank" rel="noopener noreferrer">
                      View commit
                    </a>
                  </Button>
                </div>
              </div>
            ) : publishError ? (
              <div className="rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
                <div className="mb-1 flex items-center gap-2 font-medium text-red-800 dark:text-red-300">
                  <XCircle className="size-5" />
                  Publishing failed
                </div>
                <p className="text-red-700 dark:text-red-400">{publishError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={startPublish}
                  disabled={publishing}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Loader2 className="size-4 animate-spin" />
                {publishStatus ?? "Starting…"}
              </div>
            )}

            {/* Log */}
            <div className="max-h-48 overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
              {publishLog.length === 0 ? (
                <span className="text-zinc-500">Waiting for progress…</span>
              ) : (
                publishLog.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>

            {(outcome || publishError) && (
              <Button
                variant="outline"
                onClick={() => {
                  // Reset wizard for another upload.
                  setStep(1);
                  setFile(null);
                  setResult(null);
                  setOutcome(null);
                  setPublishError(null);
                  setPublishStatus(null);
                  setPublishLog([]);
                }}
              >
                Start another upload
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
