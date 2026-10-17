import type { PropertyInput } from "@/lib/validation/project";

/** Form-state helpers shared by client forms and server pages (no "use client"). */

export type FieldErrors = Record<string, string[] | undefined>;

export interface PropertyFormState {
  streetAddress: string;
  unit: string;
  postalCode: string;
  municipality: string;
  district: string;
  buildingType: PropertyInput["buildingType"];
  ownershipForm: PropertyInput["ownershipForm"];
  livingAreaM2: string;
  rooms: string;
  layout: string;
  buildYear: string;
  floor: string;
  floorsTotal: string;
  hasElevator: "" | "yes" | "no";
  hasSauna: boolean;
  hasBalcony: boolean;
  plotType: PropertyInput["plotType"];
  condition: PropertyInput["condition"];
  energyClass: string;
}

export const emptyProperty: PropertyFormState = {
  streetAddress: "",
  unit: "",
  postalCode: "",
  municipality: "",
  district: "",
  buildingType: "apartment",
  ownershipForm: "housing_company_share",
  livingAreaM2: "",
  rooms: "",
  layout: "",
  buildYear: "",
  floor: "",
  floorsTotal: "",
  hasElevator: "",
  hasSauna: false,
  hasBalcony: false,
  plotType: "unknown",
  condition: "satisfactory",
  energyClass: "",
};

const num = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Convert form strings to the payload validated by propertySchema on the server. */
export function toPropertyPayload(s: PropertyFormState) {
  return {
    ...s,
    livingAreaM2: num(s.livingAreaM2),
    rooms: num(s.rooms),
    buildYear: num(s.buildYear),
    floor: num(s.floor),
    floorsTotal: num(s.floorsTotal),
    hasElevator: s.hasElevator === "" ? null : s.hasElevator === "yes",
  };
}

export function fromProperty(p: Omit<PropertyInput, "unit" | "district" | "layout" | "energyClass"> & { unit: string | null; district: string | null; layout: string | null; energyClass: string | null }): PropertyFormState {
  const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    streetAddress: p.streetAddress,
    unit: p.unit ?? "",
    postalCode: p.postalCode,
    municipality: p.municipality,
    district: p.district ?? "",
    buildingType: p.buildingType,
    ownershipForm: p.ownershipForm,
    livingAreaM2: str(p.livingAreaM2),
    rooms: str(p.rooms),
    layout: p.layout ?? "",
    buildYear: str(p.buildYear),
    floor: str(p.floor),
    floorsTotal: str(p.floorsTotal),
    hasElevator: p.hasElevator === null ? "" : p.hasElevator ? "yes" : "no",
    hasSauna: p.hasSauna,
    hasBalcony: p.hasBalcony,
    plotType: p.plotType,
    condition: p.condition,
    energyClass: p.energyClass ?? "",
  };
}

