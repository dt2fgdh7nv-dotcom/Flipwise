"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "../safe-next";

export function SignInForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    if (mode === "password") {
      const { error } = await authClient.signIn.email({ email, password });
      setPending(false);
      if (error) return setError(error.message ?? "Sign-in failed");
      router.push(next);
      router.refresh();
    } else {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: next });
      setPending(false);
      if (error) return setError(error.message ?? "Could not send link");
      setSent(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("signInTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Alert tone="success">{t("magicLinkSent", { email })}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label={t("email")} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {mode === "password" ? (
              <Field
                label={
                  <span className="flex w-full justify-between">
                    {t("password")}
                    <Link href="/forgot-password" className="text-xs font-normal text-primary hover:underline">
                      {t("forgot")}
                    </Link>
                  </span>
                }
                htmlFor="password"
              >
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            ) : null}
            <Button type="submit" disabled={pending} size="lg">
              {mode === "password" ? t("signIn") : t("magicLink")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(mode === "password" ? "magic" : "password")}>
              {mode === "password" ? t("magicLink") : t("usePassword")}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          {t("noAccount")}{" "}
          <Link href={`/sign-up${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
