"use client";

import { GitBranch } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Button, type ButtonProps } from "@/components/ui/button";

export function GitHubLoginButton({
  label = "Continue with GitHub",
  ...props
}: { label?: string } & ButtonProps) {
  return (
    <form action={login}>
      <Button type="submit" {...props}>
        <GitBranch className="size-4" />
        {label}
      </Button>
    </form>
  );
}
