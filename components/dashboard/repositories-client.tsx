"use client";

import { useEffect, useState } from "react";
import { Lock, Globe, RefreshCw, Plus, ExternalLink } from "lucide-react";
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
import { formatDate } from "@/lib/utils";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  visibility: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string | null;
}

export function RepositoriesClient() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadRepos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRepos(data.repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRepos();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, private: isPrivate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create repository");
      setName("");
      setDescription("");
      await loadRepos();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a repository</CardTitle>
          <CardDescription>
            A new empty repository will be created on your GitHub account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="repo-name">Repository name</Label>
                <Input
                  id="repo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                  required
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                  />
                  Private
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                  />
                  Public
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repo-desc">Description (optional)</Label>
              <Textarea
                id="repo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project?"
              />
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <Button type="submit" disabled={creating || !name}>
              <Plus className="size-4" />
              {creating ? "Creating…" : "Create repository"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Your GitHub repositories</CardTitle>
            <CardDescription>Owned repositories, most recent first</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadRepos} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-6 text-center text-sm text-red-600">{error}</p>
          ) : loading ? (
            <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>
          ) : repos.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No repositories found.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {repos.map((repo) => (
                <li
                  key={repo.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {repo.name}
                      </span>
                      <Badge variant="outline">
                        {repo.private ? (
                          <Lock className="mr-1 size-3" />
                        ) : (
                          <Globe className="mr-1 size-3" />
                        )}
                        {repo.visibility}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {repo.defaultBranch} ·{" "}
                      {repo.updatedAt
                        ? `updated ${formatDate(repo.updatedAt)}`
                        : ""}
                    </div>
                  </div>
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
