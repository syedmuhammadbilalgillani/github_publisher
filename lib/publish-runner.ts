import { processZip } from "./zip";
import { readTempZip, deleteTempZip } from "./storage";
import {
  createRepository,
  publishToRepository,
  type GitHubRepo,
} from "./github";
import { prisma } from "./prisma";
import { getGitHubToken } from "./session";

export type PublishTarget =
  | {
      mode: "create";
      name: string;
      description?: string;
      private: boolean;
    }
  | { mode: "existing"; fullName: string };

export interface PublishRequest {
  userId: string;
  uploadId: string;
  branch: string;
  commitMessage: string;
  target: PublishTarget;
  /** Reuse an existing PublishJob (retry) instead of creating a new one. */
  existingJobId?: string;
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

/**
 * Runs a publish operation and returns a streaming SSE Response that reports
 * progress in real time while persisting the PublishJob's status and logs.
 */
export function createPublishStream(req: PublishRequest): Response {
  const { userId, uploadId, branch, commitMessage, target } = req;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const logLines: string[] = [];
      let jobId = req.existingJobId;

      const emit = async (status: string, message: string): Promise<void> => {
        logLines.push(`[${new Date().toISOString()}] ${message}`);
        controller.enqueue(sse("progress", { status, message }));
        if (jobId) {
          await prisma.publishJob.update({
            where: { id: jobId },
            data: { status: status as never, logs: logLines.join("\n") },
          });
        }
      };

      try {
        const upload = await prisma.upload.findFirst({
          where: { id: uploadId, userId },
        });
        if (!upload) throw new Error("Upload not found");

        const token = await getGitHubToken(userId);

        if (!jobId) {
          const job = await prisma.publishJob.create({
            data: {
              userId,
              uploadId,
              projectName: upload.zipName.replace(/\.zip$/i, ""),
              branch,
              commitMessage,
              status: "QUEUED",
            },
          });
          jobId = job.id;
        }
        controller.enqueue(sse("job", { jobId }));

        await emit("EXTRACTING", "Extracting and validating archive…");
        const bytes = await readTempZip(uploadId);
        const processed = processZip(bytes);
        await emit("READING", `Read ${processed.fileCount} files`);

        let repo: Pick<GitHubRepo, "fullName" | "htmlUrl"> & {
          id?: number;
          name: string;
          visibility?: string;
          defaultBranch?: string;
        };
        let repositoryRecordId: string | undefined;

        if (target.mode === "create") {
          await emit("CREATING_REPO", `Creating repository "${target.name}"…`);
          const created = await createRepository(token, {
            name: target.name,
            description: target.description,
            private: target.private,
          });
          repo = created;
          const record = await prisma.repository.create({
            data: {
              githubRepoId: String(created.id),
              name: created.name,
              fullName: created.fullName,
              visibility: created.visibility,
              defaultBranch: created.defaultBranch,
              htmlUrl: created.htmlUrl,
              ownerId: userId,
            },
          });
          repositoryRecordId = record.id;
        } else {
          repo = {
            name: target.fullName.split("/")[1] ?? target.fullName,
            fullName: target.fullName,
            htmlUrl: `https://github.com/${target.fullName}`,
          };
        }

        const [owner, repoName] = repo.fullName.split("/");

        await prisma.publishJob.update({
          where: { id: jobId },
          data: { repositoryId: repositoryRecordId, repoUrl: repo.htmlUrl },
        });

        await emit("COMMITTING", "Building commit…");
        const result = await publishToRepository(
          {
            token,
            owner,
            repo: repoName,
            branch,
            commitMessage,
            files: processed.files,
          },
          (message) => emit("PUSHING", message)
        );

        await prisma.publishJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            commitHash: result.commitHash,
            repoUrl: repo.htmlUrl,
            error: null,
            logs: logLines.join("\n"),
          },
        });

        await deleteTempZip(uploadId);

        controller.enqueue(
          sse("completed", {
            jobId,
            commitHash: result.commitHash,
            commitUrl: result.commitUrl,
            repoUrl: repo.htmlUrl,
            branch: result.branch,
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Publishing failed";
        if (jobId) {
          await prisma.publishJob.update({
            where: { id: jobId },
            data: { status: "FAILED", error: message, logs: logLines.join("\n") },
          });
        }
        controller.enqueue(sse("failed", { error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
