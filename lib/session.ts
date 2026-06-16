import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

/** Returns the current session, or null if unauthenticated. */
export async function getSession() {
  return auth();
}

/**
 * Returns the current user's id, redirecting to the landing page when not
 * authenticated. Use in Server Components / Server Actions that require auth.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  return session.user.id;
}

/**
 * Fetches and decrypts the stored GitHub access token for a user.
 * Throws if the user has not connected GitHub or the token is missing.
 */
export async function getGitHubToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true },
  });
  if (!user?.githubAccessToken) {
    throw new Error("GitHub account not connected. Please sign in again.");
  }
  return decrypt(user.githubAccessToken);
}
