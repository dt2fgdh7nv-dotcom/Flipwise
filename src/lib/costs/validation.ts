import { z } from "zod";

export const COST_CATEGORIES = ["kitchen", "bathroom", "flooring", "walls_paint", "doors", "electrical", "sauna", "balcony", "general"] as const;
export const COST_UNITS = ["m2", "lm", "pcs", "set", "room"] as const;
export const CERTIFICATIONS = ["waterproofing", "electrical", "plumbing", "asbestos"] as const;
export const QUALITY_TIERS = ["budget", "mid", "premium"] as const;

const price = z.number({ error: "Enter a price" }).int().min(0).max(10_000_000);

/** Price fields only — used for workspace overrides. Cents excl. VAT. */
export const costPricesSchema = z
  .object({
    budgetLow: price,
    budgetHigh: price,
    midLow: price,
    midHigh: price,
    premiumLow: price,
    premiumHigh: price,
    laborBps: z.number().int().min(0).max(10_000),
    priceDate: z.iso.date(),
    source: z.string().trim().min(2, "Where do these prices come from?").max(200),
    sourceUrl: z
      .url()
      .or(z.literal(""))
      .nullish()
      .transform((v) => v || null),
    notes: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((v) => v || null),
  })
  .refine((v) => v.budgetLow <= v.budgetHigh && v.midLow <= v.midHigh && v.premiumLow <= v.premiumHigh, { message: "Low must not exceed high", path: ["budgetHigh"] });

export const costItemSchema = z.intersection(
  costPricesSchema,
  z.object({
    code: z
      .string()
      .trim()
      .regex(/^[a-z_]+\.[a-z0-9_]+$/, "Use the form category.item_name"),
    category: z.enum(COST_CATEGORIES),
    nameEn: z.string().trim().min(2).max(160),
    nameFi: z
      .string()
      .trim()
      .max(160)
      .nullish()
      .transform((v) => v || null),
    unit: z.enum(COST_UNITS),
    certification: z.enum(CERTIFICATIONS).nullable(),
    needsRenovationNotice: z.boolean(),
    active: z.boolean().default(true),
  }),
);
export type CostItemInput = z.infer<typeof costItemSchema>;
