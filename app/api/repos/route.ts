import { NextResponse, type NextRequest } from "next/server";
import { requireUserId, getGitHubToken } from "@/lib/session";
import { listRepositories, createRepository } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repository name"),
  description: z.string().max(350).optional(),
  private: z.boolean().default(true),
});

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getGitHubToken(userId);
    const repos = await listRepositories(token);
    return NextResponse.json({ repositories: repos });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load repositories";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`repo-create:${userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const token = await getGitHubToken(userId);
    const repo = await createRepository(token, parsed.data);

    await prisma.repository.create({
      data: {
        githubRepoId: String(repo.id),
        name: repo.name,
        fullName: repo.fullName,
        visibility: repo.visibility,
        defaultBranch: repo.defaultBranch,
        htmlUrl: repo.htmlUrl,
        ownerId: userId,
      },
    });

    return NextResponse.json({ repository: repo });
  } catch (err: unknown) {
    // Surface GitHub's "name already exists" and similar errors clearly.
    const status =
      typeof err === "object" && err && "status" in err
        ? (err as { status: number }).status
        : 502;
    const message =
      err instanceof Error ? err.message : "Failed to create repository";
    return NextResponse.json(
      { error: message },
      { status: status === 422 ? 409 : 502 }
    );
  }
}
