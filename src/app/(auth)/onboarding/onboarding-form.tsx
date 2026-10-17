"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createWorkspace } from "../workspace";

export function OnboardingForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await createWorkspace(name);
        if (!res.ok) return setError(res.error);
        router.push("/app");
        router.refresh();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={t("workspace")} hint={t("workspaceHint")} htmlFor="workspace">
        <Input id="workspace" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit">{t("onboardingTitle")}</Button>
    </form>
  );
}
