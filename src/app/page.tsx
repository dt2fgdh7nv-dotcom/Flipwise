import { ArrowRight, Calculator, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export default async function Landing() {
  const t = await getTranslations("landing");
  const features = [
    { icon: Calculator, title: t("f1"), body: t("f1d") },
    { icon: ShieldCheck, title: t("f2"), body: t("f2d") },
    { icon: Users, title: t("f3"), body: t("f3d") },
  ];
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo className="text-lg" />
        <Button asChild variant="ghost">
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
      </header>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{t("tagline")}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{t("sub")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">
              {t("cta")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
