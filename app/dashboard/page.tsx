import Link from "next/link";
import { UploadCloud, FolderGit2, History, CheckCircle2 } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const userId = await requireUserId();

  const [repoCount, uploadCount, completed, recentJobs] = await Promise.all([
    prisma.repository.count({ where: { ownerId: userId } }),
    prisma.upload.count({ where: { userId } }),
    prisma.publishJob.count({ where: { userId, status: "COMPLETED" } }),
    prisma.publishJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { repository: true },
    }),
  ]);

  const stats = [
    { label: "Repositories", value: repoCount, icon: FolderGit2 },
    { label: "Uploads", value: uploadCount, icon: UploadCloud },
    { label: "Published", value: completed, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-zinc-500">
            Upload a ZIP and publish it to GitHub.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/upload">
            <UploadCloud className="size-4" />
            New upload
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className="size-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Your latest publish jobs</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/activity">
              <History className="size-4" />
              View all
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No publish jobs yet.{" "}
              <Link href="/dashboard/upload" className="underline">
                Start your first upload
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {job.projectName}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {job.repository?.fullName ?? "—"} ·{" "}
                      {formatDate(job.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.commitHash && (
                      <Badge variant="outline">
                        {job.commitHash.slice(0, 7)}
                      </Badge>
                    )}
                    <StatusBadge status={job.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
