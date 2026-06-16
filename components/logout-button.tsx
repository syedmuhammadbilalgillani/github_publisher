"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
        <LogOut className="size-4" />
        Sign out
      </Button>
    </form>
  );
}
