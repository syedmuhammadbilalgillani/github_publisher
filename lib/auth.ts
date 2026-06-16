import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { encrypt } from "./crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GitHub({
      // Request repo scope so we can create repositories and push code.
      authorization: {
        params: { scope: "read:user user:email repo" },
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Persist the GitHub identity and the encrypted access token.
      if (account?.provider === "github" && account.access_token && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            githubId: profile?.id ? String(profile.id) : undefined,
            githubUsername:
              typeof profile?.login === "string" ? profile.login : undefined,
            githubAccessToken: encrypt(account.access_token),
          },
        });
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
