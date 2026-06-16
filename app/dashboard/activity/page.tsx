import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RetryButton } from "@/components/dashboard/retry-button";
import { formatDate } from "@/lib/utils";

export default async function ActivityPage() {
  const userId = await requireUserId();
  const jobs = await prisma.publishJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { repository: true },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-zinc-500">
          Every publish operation, with logs and status.
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-500">
            No activity yet.{" "}
            <Link href="/dashboard/upload" className="underline">
              Publish your first project
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {job.projectName}
                    {job.commitHash && (
                      <Badge variant="outline">
                        {job.commitHash.slice(0, 7)}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {job.repository?.fullName ?? "—"} · branch {job.branch} ·{" "}
                    {formatDate(job.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={job.status} />
                  {job.repoUrl && (
                    <a
                      href={job.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  {job.status === "FAILED" && <RetryButton jobId={job.id} />}
                </div>
              </CardHeader>
              {(job.logs || job.error) && (
                <CardContent>
                  {job.error && (
                    <p className="mb-2 text-sm text-red-600">{job.error}</p>
                  )}
                  {job.logs && (
                    <details>
                      <summary className="cursor-pointer text-sm text-zinc-500">
                        View logs
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                        {job.logs}
                      </pre>
                    </details>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
