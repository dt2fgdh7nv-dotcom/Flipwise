import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shared/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center">
      <Link href="/" className="mb-8">
        <Logo className="text-lg" />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-muted">{t("gdprNote")}</p>
      {process.env.NODE_ENV !== "production" ? (
        <Link href="/dev/mail" className="mt-2 text-xs text-info underline">
          {t("devMailHint")}
        </Link>
      ) : null}
    </div>
  );
}
