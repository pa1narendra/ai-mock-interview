"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";

// Sign out is only offered on the dashboard, to keep the rest of the app
// focused on the task at hand.
const SignOutButton = () => {
  const pathname = usePathname();
  if (pathname !== "/dashboard") return null;

  return (
    <form action={signOut}>
      <button type="submit" className="btn-outline !px-4 !py-2 text-xs">
        <LogOut className="size-3.5" /> Sign out
      </button>
    </form>
  );
};

export default SignOutButton;
