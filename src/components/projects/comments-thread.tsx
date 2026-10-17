"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { addComment } from "@/server/actions/comments";

export interface CommentView {
  id: string;
  body: string;
  authorName: string;
  isClient: boolean;
  createdAt: Date;
}

export function CommentsThread({ projectId, comments, canComment }: { projectId: string; comments: CommentView[]; canComment: boolean }) {
  const t = useTranslations("overview");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? <p className="text-sm text-muted">{t("noComments")}</p> : null}
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-surface-muted/60 p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-foreground">{c.authorName}</span>
              {c.isClient ? <Badge tone="info">{t("client")}</Badge> : null}
              <span>{formatDate(c.createdAt)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
          </li>
        ))}
      </ul>
      {canComment ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addComment(projectId, body);
              if (!res.ok) return void toast.error(res.error);
              setBody("");
              router.refresh();
            });
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("commentPlaceholder")} required maxLength={4000} />
          <Button type="submit" size="sm" className="self-end" disabled={pending || !body.trim()}>
            {t("postComment")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
