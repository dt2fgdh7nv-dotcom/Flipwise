/**
 * Typical line items per room type ("add typical items" in the room builder).
 * Quantities are estimated from room floor area; the flipper adjusts them afterwards.
 */
import type { QualityTier } from "@/lib/costs/seed-catalogue";

export const ROOM_TYPES = ["kitchen", "bathroom", "toilet", "sauna", "living_room", "bedroom", "hallway", "balcony", "whole_apartment"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export interface TemplateContext {
  areaM2: number;
  tier: QualityTier;
  buildYear: number;
  asbestosBeforeYear: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Wall area for a roughly square room, 2.5 m ceiling, ~15 % openings. */
export function estimateWallArea(floorM2: number, height = 2.5) {
  if (floorM2 <= 0) return 0;
  return round1(4 * Math.sqrt(floorM2) * height * 0.85);
}

const floorCovering = (c: TemplateContext) => (c.tier === "premium" ? "flooring.parquet" : c.tier === "mid" ? "flooring.vinyl" : "flooring.laminate");

type Rule = { code: string | ((c: TemplateContext) => string); qty: (c: TemplateContext) => number; when?: (c: TemplateContext) => boolean };

const dryRoom = (sockets: number, doors: number): Rule[] => [
  { code: "flooring.removal", qty: (c) => c.areaM2 },
  { code: floorCovering, qty: (c) => c.areaM2 },
  { code: "walls.paint", qty: (c) => estimateWallArea(c.areaM2) },
  { code: "walls.ceiling_paint", qty: (c) => c.areaM2 },
  { code: "electrical.light_fixture", qty: () => 1 },
  ...(sockets ? [{ code: "electrical.socket", qty: () => sockets }] : []),
  ...(doors ? [{ code: "doors.interior", qty: () => doors }] : []),
];

const TEMPLATES: Record<RoomType, Rule[]> = {
  kitchen: [
    { code: "kitchen.demolition", qty: () => 1 },
    { code: "kitchen.cabinets", qty: () => 3.6 },
    { code: "kitchen.countertop", qty: () => 3.6 },
    { code: "kitchen.appliances", qty: () => 1 },
    { code: "kitchen.sink_plumbing", qty: () => 1 },
    { code: "kitchen.backsplash", qty: () => 2.5 },
    { code: "electrical.downlight", qty: () => 3 },
    { code: floorCovering, qty: (c) => c.areaM2 },
    { code: "walls.paint", qty: (c) => round1(estimateWallArea(c.areaM2) * 0.5) },
  ],
  bathroom: [
    { code: "bathroom.demolition", qty: (c) => c.areaM2 },
    { code: "bathroom.waterproofing", qty: (c) => round1(c.areaM2 + estimateWallArea(c.areaM2)) },
    { code: "bathroom.floor_tiling", qty: (c) => c.areaM2 },
    { code: "bathroom.wall_tiling", qty: (c) => estimateWallArea(c.areaM2) },
    { code: "bathroom.ceiling", qty: (c) => c.areaM2 },
    { code: "bathroom.fixtures", qty: () => 1 },
    { code: "bathroom.plumbing", qty: () => 1 },
    { code: "bathroom.electrical", qty: () => 1 },
    { code: "bathroom.ventilation", qty: () => 1 },
    { code: "bathroom.floor_heating", qty: (c) => c.areaM2, when: (c) => c.tier !== "budget" },
  ],
  toilet: [
    { code: "bathroom.floor_tiling", qty: (c) => c.areaM2 },
    { code: "walls.paint", qty: (c) => estimateWallArea(c.areaM2) },
    { code: "bathroom.fixtures", qty: () => 1 },
    { code: "bathroom.ventilation", qty: () => 1 },
  ],
  sauna: [
    { code: "sauna.heater", qty: () => 1 },
    { code: "sauna.panelling", qty: (c) => round1(estimateWallArea(c.areaM2, 2.2) + c.areaM2) },
    { code: "sauna.benches", qty: () => 1 },
    { code: "sauna.door", qty: () => 1 },
  ],
  living_room: dryRoom(2, 0),
  bedroom: dryRoom(1, 1),
  hallway: dryRoom(0, 0),
  balcony: [
    { code: "balcony.floor", qty: (c) => c.areaM2 },
    { code: "balcony.paint", qty: (c) => round1(c.areaM2 * 2) },
  ],
  whole_apartment: [
    { code: "general.asbestos_survey", qty: () => 1, when: (c) => c.buildYear < c.asbestosBeforeYear },
    { code: "general.protection_waste", qty: () => 1 },
    { code: "general.cleaning", qty: (c) => c.areaM2 },
  ],
};

export function suggestLines(roomType: RoomType, ctx: TemplateContext): { code: string; quantity: number }[] {
  return TEMPLATES[roomType]
    .filter((r) => !r.when || r.when(ctx))
    .map((r) => ({ code: typeof r.code === "function" ? r.code(ctx) : r.code, quantity: Math.max(0, round1(r.qty(ctx))) }))
    .filter((l) => l.quantity > 0);
}

/** Default floor areas when the flipper hasn't measured yet. */
export const DEFAULT_ROOM_AREA: Record<RoomType, number> = {
  kitchen: 8,
  bathroom: 4,
  toilet: 1.5,
  sauna: 2.5,
  living_room: 18,
  bedroom: 11,
  hallway: 6,
  balcony: 4,
  whole_apartment: 50,
};
