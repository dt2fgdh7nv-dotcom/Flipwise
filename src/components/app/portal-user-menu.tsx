"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

export function PortalUserMenu({ name }: { name: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted sm:inline">{name}</span>
      <button
        className="flex items-center gap-1.5 text-muted hover:text-foreground"
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
          router.refresh();
        }}
      >
        <LogOut className="size-4" /> {t("signOut")}
      </button>
    </div>
  );
}
