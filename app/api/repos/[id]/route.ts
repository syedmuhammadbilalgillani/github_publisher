import { NextResponse, type NextRequest } from "next/server";
import { requireUserId, getGitHubToken } from "@/lib/session";
import { deleteRepository } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Deletes a repository record. If it was created through this app and lives on
// GitHub, also delete it on GitHub (requires the `delete_repo` OAuth scope,
// which is not requested by default — the GitHub call is best-effort).
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const repo = await prisma.repository.findFirst({
    where: { id, ownerId: userId },
  });
  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  if (repo.fullName) {
    try {
      const token = await getGitHubToken(userId);
      const [owner, name] = repo.fullName.split("/");
      await deleteRepository(token, owner, name);
    } catch {
      // GitHub deletion may fail without the delete_repo scope; we still
      // remove the local record so the dashboard stays consistent.
    }
  }

  await prisma.repository.delete({ where: { id: repo.id } });
  return NextResponse.json({ success: true });
}
