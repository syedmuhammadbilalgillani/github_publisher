import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // GitHub user avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // Octokit and Prisma are server-only; keep them out of the client bundle.
  serverExternalPackages: ["@octokit/rest", "@prisma/client"],
};

export default nextConfig;
