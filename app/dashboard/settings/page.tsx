import { GitBranch, ShieldCheck, KeyRound } from "lucide-react";
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
import { LogoutButton } from "@/components/logout-button";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      githubUsername: true,
      githubId: true,
      githubAccessToken: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-500">
          Manage your connected GitHub account and security.
        </p>
      </div>

      {/* GitHub account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="size-4" /> GitHub account
          </CardTitle>
          <CardDescription>Your connected identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={user?.name ?? "—"} />
          <Row
            label="Username"
            value={user?.githubUsername ? `@${user.githubUsername}` : "—"}
          />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="GitHub ID" value={user?.githubId ?? "—"} />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Security
          </CardTitle>
          <CardDescription>How your credentials are protected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-zinc-400" />
              GitHub access token
            </span>
            {user?.githubAccessToken ? (
              <Badge variant="success">Encrypted &amp; stored</Badge>
            ) : (
              <Badge variant="warning">Not connected</Badge>
            )}
          </div>
          <p className="text-zinc-500">
            Your OAuth access token is encrypted with AES-256-GCM before being
            stored. It is only decrypted server-side to create repositories and
            push your files. We never ask for personal access tokens.
          </p>
        </CardContent>
      </Card>

      {/* Account actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Sign out of this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-40">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
