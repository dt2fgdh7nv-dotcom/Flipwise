"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProperty } from "@/app/app/projects/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { PropertyFields, toPropertyPayload, type FieldErrors, type PropertyFormState } from "./property-fields";

export function PropertyEditButton({ projectId, name, initial }: { projectId: string; name: string; initial: PropertyFormState }) {
  const t = useTranslations("overview");
  const tp = useTranslations("property");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState(name);
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("editProperty")}
      trigger={
        <Button variant="secondary" size="sm">
          <Pencil /> {tc("edit")}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateProperty(projectId, { name: projectName, ...toPropertyPayload(value) });
            if (!res.ok) {
              setError(res.error);
              setErrors(res.fieldErrors ?? {});
              return;
            }
            toast.success(tp("saved"));
            setOpen(false);
            router.refresh();
          });
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label={tp("name")} error={errors.name} htmlFor="projectName">
          <Input id="projectName" required value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        </Field>
        <PropertyFields value={value} onChange={setValue} errors={errors} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
