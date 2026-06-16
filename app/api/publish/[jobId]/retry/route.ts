import { type NextRequest } from "next/server";
import { requireUserId } from "@/lib/session";
import { createPublishStream } from "@/lib/publish-runner";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const { jobId } = await ctx.params;

  const rl = checkRateLimit(`publish:${userId}`, 5, 60_000);
  if (!rl.success) {
    return jsonError("Too many publish requests. Please wait.", 429);
  }

  const job = await prisma.publishJob.findFirst({
    where: { id: jobId, userId },
    include: { repository: true },
  });
  if (!job) return jsonError("Job not found", 404);
  if (job.status === "COMPLETED") {
    return jsonError("This job already completed successfully", 409);
  }

  // Re-publish to the same repository if one was recorded, otherwise we cannot
  // safely recreate the original target.
  if (!job.repository?.fullName) {
    return jsonError(
      "Cannot retry: original repository is unknown. Start a new upload.",
      400
    );
  }

  return createPublishStream({
    userId,
    uploadId: job.uploadId,
    branch: job.branch,
    commitMessage: job.commitMessage,
    target: { mode: "existing", fullName: job.repository.fullName },
    existingJobId: job.id,
  });
}
