import Image from "next/image";
import { UploadCloud } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardNav } from "@/components/dashboard/nav";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, githubUsername: true, image: true, email: true },
  });

  return (
    <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-8 flex items-center gap-2 px-3 font-semibold">
          <UploadCloud className="size-5" />
          ZipShip
        </div>

        <DashboardNav />

        <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center gap-3 px-3">
            {user?.image ? (
              <Image
                src={user.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {user?.name ?? "GitHub user"}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {user?.githubUsername
                  ? `@${user.githubUsername}`
                  : user?.email}
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
