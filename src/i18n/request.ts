import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["en"] as const; // fi, sv to follow
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get("fw_locale")?.value;
  const locale = (LOCALES as readonly string[]).includes(fromCookie ?? "") ? (fromCookie as Locale) : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Helsinki",
  };
});
