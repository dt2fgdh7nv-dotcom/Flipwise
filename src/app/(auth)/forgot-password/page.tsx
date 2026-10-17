"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setSent(true); // Same response whether or not the account exists.
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("forgotTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Alert tone="success">{t("forgotSent", { email })}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label={t("email")} htmlFor="email">
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit">{t("forgotSend")}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
