import { UploadWizard } from "@/components/dashboard/upload-wizard";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Upload & Publish</h1>
        <p className="text-sm text-zinc-500">
          Upload a ZIP, preview it, pick a repository, and publish to GitHub.
        </p>
      </div>
      <UploadWizard />
    </div>
  );
}
