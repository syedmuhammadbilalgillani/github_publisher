import { RepositoriesClient } from "@/components/dashboard/repositories-client";

export default function RepositoriesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Repositories</h1>
        <p className="text-sm text-zinc-500">
          Create a new repository or browse the ones you already own on GitHub.
        </p>
      </div>
      <RepositoriesClient />
    </div>
  );
}
