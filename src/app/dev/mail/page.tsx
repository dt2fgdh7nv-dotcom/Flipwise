import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { devMail } from "@/db/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Dev mail", robots: { index: false } };

/** Development-only outbox for magic links and invitations. */
export default async function DevMailPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const mails = await db.select().from(devMail).orderBy(desc(devMail.createdAt)).limit(30);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dev mail outbox</h1>
      <p className="mt-1 text-sm text-muted">Emails are captured here in development instead of being sent.</p>
      <ul className="mt-6 space-y-3">
        {mails.map((m) => (
          <li key={m.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">
              {formatDate(m.createdAt)} {m.createdAt.toLocaleTimeString("en-GB")} · to {m.to}
            </p>
            <p className="mt-1 font-medium">{m.subject}</p>
            <p className="mt-2 break-all text-sm">
              {m.body.split(/(https?:\/\/\S+)/).map((part, i) =>
                part.startsWith("http") ? (
                  <a key={i} href={part} className="text-primary underline">
                    {part}
                  </a>
                ) : (
                  part
                ),
              )}
            </p>
          </li>
        ))}
        {mails.length === 0 ? <li className="text-sm text-muted">No mail yet.</li> : null}
      </ul>
    </main>
  );
}
