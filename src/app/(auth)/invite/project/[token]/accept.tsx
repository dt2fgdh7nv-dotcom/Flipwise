"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { acceptShare } from "@/server/actions/sharing";

export function AcceptShareButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptShare(token);
          if (!res.ok) return void toast.error(res.error);
          router.push(`/portal/projects/${res.data!.projectId}`);
        })
      }
    >
      {label}
    </Button>
  );
}

export function SignOutAndRetry({ next, email }: { next: string; email: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await authClient.signOut();
        router.push(`/sign-in?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`);
      }}
    >
      {t("signOut")}
    </Button>
  );
}
