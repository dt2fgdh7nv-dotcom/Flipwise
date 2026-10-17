"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "../safe-next";
import { createWorkspace } from "../workspace";

export function SignUpForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  // Clients arriving from a project invite don't create a workspace.
  const isInvite = (params.get("next") ?? "").startsWith("/invite/");
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ name: "", email: params.get("email") ?? "", password: "", workspace: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await authClient.signUp.email({ name: form.name, email: form.email, password: form.password });
    if (error) {
      setPending(false);
      return setError(error.message ?? "Sign-up failed");
    }
    if (!isInvite) {
      const res = await createWorkspace(form.workspace);
      if (!res.ok) {
        setPending(false);
        return setError(res.error);
      }
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isInvite ? t("signUpClientTitle") : t("signUpTitle")}</CardTitle>
        <CardDescription>{isInvite ? t("signUpClientSubtitle") : t("signUpSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t("name")} htmlFor="name">
            <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} />
          </Field>
          <Field label={t("email")} htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
          </Field>
          <Field label={t("password")} hint={t("passwordHint")} htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" minLength={10} required value={form.password} onChange={set("password")} />
          </Field>
          {!isInvite ? (
            <Field label={t("workspace")} hint={t("workspaceHint")} htmlFor="workspace">
              <Input id="workspace" required value={form.workspace} onChange={set("workspace")} />
            </Field>
          ) : null}
          <Button type="submit" disabled={pending} size="lg">
            {t("signUp")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {t("haveAccount")}{" "}
          <Link href={`/sign-in${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
