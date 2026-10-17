"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function JoinTeamButton({ invitationId, label }: { invitationId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
          if (error) return void toast.error(error.message ?? "Could not join");
          await authClient.organization.setActive({ organizationId: data.member.organizationId });
          router.push("/app");
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}
