import { Badge } from "@/components/ui/badge";

const MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
> = {
  QUEUED: { label: "Queued", variant: "secondary" },
  UPLOADING: { label: "Uploading", variant: "warning" },
  EXTRACTING: { label: "Extracting", variant: "warning" },
  READING: { label: "Reading", variant: "warning" },
  CREATING_REPO: { label: "Creating repo", variant: "warning" },
  COMMITTING: { label: "Committing", variant: "warning" },
  PUSHING: { label: "Pushing", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
