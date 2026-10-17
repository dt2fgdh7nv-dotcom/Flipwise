"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ResetForm() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setState(error ? (error.message ?? "Reset failed") : "done");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("resetTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {state === "done" ? (
          <Alert tone="success">
            {t("resetDone")}{" "}
            <Link href="/sign-in" className="underline">
              {t("signIn")}
            </Link>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {state !== "idle" ? <Alert tone="danger">{state}</Alert> : null}
            <Field label={t("password")} hint={t("passwordHint")} htmlFor="password">
              <Input id="password" type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit">{t("resetSubmit")}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
