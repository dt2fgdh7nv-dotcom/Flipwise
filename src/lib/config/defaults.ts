import { CONFIG_DEFINITIONS } from "./definitions";
import { resolveConfig, type ConfigRow } from "./resolve";

/** Config resolved from seed definitions only (tests, previews before the DB is seeded). */
export function seedConfigRows(): ConfigRow[] {
  return CONFIG_DEFINITIONS.map((d) => ({
    id: `seed:${d.key}`,
    organizationId: null,
    key: d.key,
    value: d.seed.value,
    unit: d.unit,
    validFrom: d.seed.validFrom,
    source: d.seed.source,
    sourceUrl: d.seed.sourceUrl ?? null,
    notes: d.seed.notes ?? null,
    updatedAt: new Date(0),
  }));
}

export const resolveSeedConfig = (today = "2026-10-17") => resolveConfig(seedConfigRows(), today);
