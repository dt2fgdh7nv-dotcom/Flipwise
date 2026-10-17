import "server-only";
import { db } from "@/db";
import { devMail } from "@/db/schema";

export type Mail = { to: string; subject: string; body: string };

/**
 * Mail transport. In development, mail goes to the dev_mail table (see /dev/mail)
 * and the console. Plug an EU-hosted SMTP/API provider in here for production.
 */
export async function sendMail(mail: Mail) {
  if (process.env.NODE_ENV === "production" && process.env.MAIL_TRANSPORT !== "dev") {
    // TODO(phase 6): real transport (e.g. EU-region SMTP). Fail loudly rather than silently dropping mail.
    throw new Error("No production mail transport configured");
  }
  console.info(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.body}`);
  await db.insert(devMail).values(mail);
}
