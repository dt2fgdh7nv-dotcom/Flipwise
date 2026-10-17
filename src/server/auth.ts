import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendMail } from "./mailer";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "FlipWise",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  telemetry: { enabled: false },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your FlipWise password",
        body: `Reset your password: ${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      isPlatformAdmin: { type: "boolean", defaultValue: false, input: false },
      locale: { type: "string", defaultValue: "en", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: true, window: 60, max: 100 },
  plugins: [
    organization({
      creatorRole: "owner",
      // Tenants are created during sign-up; clients never need their own org.
      allowUserToCreateOrganization: true,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      schema: {
        organization: {
          additionalFields: {
            planTier: { type: "string", defaultValue: "free", input: false },
            defaultTaxProfile: { type: "string", defaultValue: "company", input: false },
            vatDisplay: { type: "string", defaultValue: "excl", input: false },
            vatDeductible: { type: "boolean", defaultValue: false, input: false },
          },
        },
      },
      sendInvitationEmail: async ({ id, email, organization: org, inviter }) => {
        await sendMail({
          to: email,
          subject: `${inviter.user.name} invited you to ${org.name} on FlipWise`,
          body: `Join the workspace: ${appUrl}/invite/team/${id}`,
        });
      },
    }),
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendMail({ to: email, subject: "Your FlipWise sign-in link", body: `Sign in: ${url}` });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
