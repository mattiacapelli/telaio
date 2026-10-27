"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="glass"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
      }}
    >
      Esci
    </Button>
  );
}
