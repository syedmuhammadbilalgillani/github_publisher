import { type NextRequest } from "next/server";
import { requireUserId } from "@/lib/session";
import { createPublishStream } from "@/lib/publish-runner";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
// Publishing can take a while for larger archives.
export const maxDuration = 300;

const bodySchema = z.object({
  uploadId: z.string().min(1),
  branch: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\s~^:?*\[\\]+$/, "Invalid branch name")
    .default("main"),
  commitMessage: z.string().min(1).max(500).default("Initial project upload"),
  target: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("create"),
      name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repository name"),
      description: z.string().max(350).optional(),
      private: z.boolean().default(true),
    }),
    z.object({
      mode: z.literal("existing"),
      fullName: z.string().min(1),
    }),
  ]),
});

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const rl = checkRateLimit(`publish:${userId}`, 5, 60_000);
  if (!rl.success) {
    return jsonError("Too many publish requests. Please wait.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  return createPublishStream({ userId, ...parsed.data });
}
