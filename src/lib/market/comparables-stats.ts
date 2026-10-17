/** Summary statistics over comparable sales (prices in cents). */
export function comparablesStats(rows: { priceDebtFree: number; livingAreaM2: number }[], subjectAreaM2: number) {
  const perM2 = rows.filter((r) => r.livingAreaM2 > 0).map((r) => r.priceDebtFree / r.livingAreaM2).sort((a, b) => a - b);
  if (!perM2.length) return null;
  const mid = Math.floor(perM2.length / 2);
  const median = perM2.length % 2 ? perM2[mid] : (perM2[mid - 1] + perM2[mid]) / 2;
  return {
    count: perM2.length,
    medianPerM2: Math.round(median),
    minPerM2: Math.round(perM2[0]),
    maxPerM2: Math.round(perM2[perM2.length - 1]),
    impliedValue: Math.round(median * subjectAreaM2),
  };
}
