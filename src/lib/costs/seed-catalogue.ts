/**
 * Seed cost catalogue — PROVISIONAL estimates (Finland, 2026, euros excl. VAT, labour + materials).
 * These are starting values only; replace them with sourced prices (contractor price lists, your own
 * project history) via /admin/costs. The database is the source of truth after seeding.
 */

export type CostCategory = "kitchen" | "bathroom" | "flooring" | "walls_paint" | "doors" | "electrical" | "sauna" | "balcony" | "general";
export type CostUnit = "m2" | "lm" | "pcs" | "set" | "room";
export type Certification = "waterproofing" | "electrical" | "plumbing" | "asbestos";
export type QualityTier = "budget" | "mid" | "premium";

export interface SeedCostItem {
  code: string;
  category: CostCategory;
  nameEn: string;
  nameFi: string;
  unit: CostUnit;
  /** [low, high] in euros excl. VAT per unit, per tier. */
  budget: [number, number];
  mid: [number, number];
  premium: [number, number];
  laborPct: number;
  certification?: Certification;
  needsRenovationNotice?: boolean;
  notes?: string;
}

export const SEED_SOURCE = "FlipWise provisional estimate";
export const SEED_PRICE_DATE = "2026-10-17";

export const SEED_CATALOGUE: SeedCostItem[] = [
  // Kitchen
  { code: "kitchen.demolition", category: "kitchen", nameEn: "Remove old kitchen", nameFi: "Vanhan keittiön purku", unit: "room", budget: [400, 700], mid: [500, 900], premium: [600, 1000], laborPct: 90 },
  { code: "kitchen.cabinets", category: "kitchen", nameEn: "Kitchen cabinets & doors, installed", nameFi: "Keittiökalusteet asennettuna", unit: "lm", budget: [450, 800], mid: [900, 1500], premium: [1800, 3500], laborPct: 25 },
  { code: "kitchen.refresh", category: "kitchen", nameEn: "Cabinet door & handle swap (refresh)", nameFi: "Ovien ja vetimien vaihto", unit: "lm", budget: [120, 220], mid: [220, 400], premium: [400, 700], laborPct: 30 },
  { code: "kitchen.countertop", category: "kitchen", nameEn: "Countertop", nameFi: "Työtaso", unit: "lm", budget: [80, 180], mid: [250, 500], premium: [600, 1200], laborPct: 25, notes: "Budget: laminate · Mid: compact/quartz · Premium: natural stone" },
  { code: "kitchen.appliances", category: "kitchen", nameEn: "Appliance package (fridge, oven, hob, dishwasher, hood)", nameFi: "Kodinkoneet", unit: "set", budget: [1800, 2800], mid: [3000, 5000], premium: [6000, 12000], laborPct: 5 },
  { code: "kitchen.sink_plumbing", category: "kitchen", nameEn: "Sink, tap & water connections", nameFi: "Allas, hana ja vesiliitännät", unit: "pcs", budget: [400, 700], mid: [700, 1100], premium: [1200, 2000], laborPct: 55, certification: "plumbing", needsRenovationNotice: true },
  { code: "kitchen.backsplash", category: "kitchen", nameEn: "Backsplash tiling", nameFi: "Välitilan laatoitus", unit: "m2", budget: [80, 120], mid: [110, 170], premium: [160, 260], laborPct: 60 },

  // Bathroom (wet room)
  { code: "bathroom.demolition", category: "bathroom", nameEn: "Strip-out to structures", nameFi: "Märkätilan purku", unit: "m2", budget: [200, 300], mid: [220, 330], premium: [250, 380], laborPct: 95, needsRenovationNotice: true, notes: "Per floor m². Requires asbestos survey in buildings started before 1994." },
  { code: "bathroom.waterproofing", category: "bathroom", nameEn: "Waterproofing (floor & walls)", nameFi: "Vedeneristys", unit: "m2", budget: [45, 65], mid: [50, 75], premium: [60, 90], laborPct: 70, certification: "waterproofing", needsRenovationNotice: true, notes: "Per waterproofed surface m²." },
  { code: "bathroom.floor_tiling", category: "bathroom", nameEn: "Floor tiling incl. screed & falls", nameFi: "Lattian laatoitus ja kaadot", unit: "m2", budget: [120, 170], mid: [150, 220], premium: [200, 320], laborPct: 65 },
  { code: "bathroom.wall_tiling", category: "bathroom", nameEn: "Wall tiling", nameFi: "Seinien laatoitus", unit: "m2", budget: [75, 110], mid: [95, 150], premium: [140, 240], laborPct: 65 },
  { code: "bathroom.fixtures", category: "bathroom", nameEn: "WC, washbasin cabinet, shower set & mirror", nameFi: "WC, allaskaluste, suihku ja peili", unit: "set", budget: [900, 1500], mid: [1600, 2800], premium: [3000, 6000], laborPct: 30, certification: "plumbing" },
  { code: "bathroom.plumbing", category: "bathroom", nameEn: "Floor drain, water pipes & connections", nameFi: "Lattiakaivo, vesijohdot ja liitännät", unit: "room", budget: [900, 1500], mid: [1100, 1800], premium: [1400, 2400], laborPct: 70, certification: "plumbing", needsRenovationNotice: true },
  { code: "bathroom.electrical", category: "bathroom", nameEn: "Wet-room electrics (lights, sockets, bonding)", nameFi: "Märkätilan sähkötyöt", unit: "room", budget: [600, 1000], mid: [800, 1300], premium: [1200, 2200], laborPct: 70, certification: "electrical", needsRenovationNotice: true },
  { code: "bathroom.ventilation", category: "bathroom", nameEn: "Exhaust valve / fan", nameFi: "Poistoilmaventtiili / puhallin", unit: "pcs", budget: [150, 300], mid: [250, 450], premium: [400, 800], laborPct: 60, needsRenovationNotice: true },
  { code: "bathroom.floor_heating", category: "bathroom", nameEn: "Electric floor heating", nameFi: "Sähköinen lattialämmitys", unit: "m2", budget: [70, 110], mid: [80, 130], premium: [100, 160], laborPct: 60, certification: "electrical" },
  { code: "bathroom.ceiling", category: "bathroom", nameEn: "Moisture-resistant ceiling", nameFi: "Märkätilan katto", unit: "m2", budget: [40, 70], mid: [60, 100], premium: [90, 150], laborPct: 70 },

  // Flooring
  { code: "flooring.removal", category: "flooring", nameEn: "Remove old floor covering", nameFi: "Vanhan lattiapinnoitteen purku", unit: "m2", budget: [8, 15], mid: [10, 18], premium: [12, 20], laborPct: 95 },
  { code: "flooring.levelling", category: "flooring", nameEn: "Floor levelling", nameFi: "Lattian tasoitus", unit: "m2", budget: [15, 30], mid: [20, 35], premium: [25, 45], laborPct: 70 },
  { code: "flooring.laminate", category: "flooring", nameEn: "Laminate incl. underlay & skirting", nameFi: "Laminaatti asennettuna", unit: "m2", budget: [28, 40], mid: [38, 55], premium: [55, 75], laborPct: 45 },
  { code: "flooring.vinyl", category: "flooring", nameEn: "Vinyl plank (LVT) incl. skirting", nameFi: "Vinyylilankku asennettuna", unit: "m2", budget: [35, 50], mid: [45, 65], premium: [60, 90], laborPct: 45 },
  { code: "flooring.parquet", category: "flooring", nameEn: "Parquet incl. skirting", nameFi: "Parketti asennettuna", unit: "m2", budget: [55, 75], mid: [75, 110], premium: [110, 180], laborPct: 35 },
  { code: "flooring.sanding", category: "flooring", nameEn: "Sand & refinish wood floor", nameFi: "Puulattian hionta ja lakkaus", unit: "m2", budget: [25, 35], mid: [30, 45], premium: [40, 60], laborPct: 85 },

  // Walls & paint
  { code: "walls.paint", category: "walls_paint", nameEn: "Paint walls incl. patching (2 coats)", nameFi: "Seinien maalaus", unit: "m2", budget: [10, 14], mid: [13, 18], premium: [17, 25], laborPct: 80, notes: "Per wall m²." },
  { code: "walls.ceiling_paint", category: "walls_paint", nameEn: "Paint ceiling", nameFi: "Katon maalaus", unit: "m2", budget: [11, 15], mid: [14, 19], premium: [18, 26], laborPct: 80 },
  { code: "walls.skim_coat", category: "walls_paint", nameEn: "Full skim coat", nameFi: "Seinien kokotasoitus", unit: "m2", budget: [12, 18], mid: [15, 22], premium: [20, 30], laborPct: 85 },
  { code: "walls.wallpaper", category: "walls_paint", nameEn: "Wallpaper", nameFi: "Tapetointi", unit: "m2", budget: [18, 26], mid: [24, 35], premium: [35, 60], laborPct: 60 },

  // Doors
  { code: "doors.interior", category: "doors", nameEn: "Interior door with frame, installed", nameFi: "Väliovi karmeineen asennettuna", unit: "pcs", budget: [280, 420], mid: [400, 650], premium: [650, 1200], laborPct: 35 },
  { code: "doors.repaint", category: "doors", nameEn: "Repaint door & frame", nameFi: "Oven ja karmin maalaus", unit: "pcs", budget: [90, 140], mid: [120, 180], premium: [160, 240], laborPct: 85 },
  { code: "doors.front", category: "doors", nameEn: "Apartment front door (fire-rated)", nameFi: "Huoneiston ulko-ovi (palo-ovi)", unit: "pcs", budget: [1200, 1800], mid: [1700, 2600], premium: [2500, 4000], laborPct: 25, needsRenovationNotice: true, notes: "Usually needs housing company approval." },

  // Electrical & lighting
  { code: "electrical.socket", category: "electrical", nameEn: "Add or move socket / switch", nameFi: "Pistorasian / kytkimen lisäys tai siirto", unit: "pcs", budget: [90, 140], mid: [110, 170], premium: [140, 220], laborPct: 70, certification: "electrical" },
  { code: "electrical.light_fixture", category: "electrical", nameEn: "Light fixture, installed", nameFi: "Valaisin asennettuna", unit: "pcs", budget: [80, 150], mid: [150, 300], premium: [300, 700], laborPct: 35, certification: "electrical" },
  { code: "electrical.downlight", category: "electrical", nameEn: "Recessed downlight", nameFi: "Upotettu kohdevalo", unit: "pcs", budget: [90, 140], mid: [120, 180], premium: [160, 260], laborPct: 60, certification: "electrical" },
  { code: "electrical.rewiring", category: "electrical", nameEn: "Full rewiring incl. new consumer unit", nameFi: "Sähköjen uusiminen ja ryhmäkeskus", unit: "m2", budget: [60, 85], mid: [75, 105], premium: [95, 140], laborPct: 70, certification: "electrical", needsRenovationNotice: true, notes: "Per apartment floor m²." },

  // Sauna
  { code: "sauna.heater", category: "sauna", nameEn: "Sauna heater incl. connection", nameFi: "Kiuas asennettuna", unit: "pcs", budget: [700, 1100], mid: [1000, 1700], premium: [1800, 3500], laborPct: 25, certification: "electrical" },
  { code: "sauna.panelling", category: "sauna", nameEn: "Wall & ceiling panelling", nameFi: "Seinien ja katon paneelointi", unit: "m2", budget: [60, 90], mid: [80, 120], premium: [120, 200], laborPct: 55 },
  { code: "sauna.benches", category: "sauna", nameEn: "Sauna benches", nameFi: "Lauteet", unit: "set", budget: [600, 1000], mid: [900, 1600], premium: [1600, 3000], laborPct: 45 },
  { code: "sauna.door", category: "sauna", nameEn: "Glass sauna door", nameFi: "Saunan lasiovi", unit: "pcs", budget: [350, 500], mid: [450, 700], premium: [700, 1200], laborPct: 25 },

  // Balcony
  { code: "balcony.floor", category: "balcony", nameEn: "Balcony floor (deck tiles / coating)", nameFi: "Parvekkeen lattia", unit: "m2", budget: [40, 70], mid: [60, 100], premium: [90, 160], laborPct: 50, needsRenovationNotice: true },
  { code: "balcony.paint", category: "balcony", nameEn: "Repaint balcony surfaces", nameFi: "Parvekkeen maalaus", unit: "m2", budget: [18, 28], mid: [25, 40], premium: [35, 55], laborPct: 80, needsRenovationNotice: true, notes: "Balcony structures usually belong to the housing company." },

  // General
  { code: "general.protection_waste", category: "general", nameEn: "Site protection, waste & skip", nameFi: "Suojaukset ja jätehuolto", unit: "pcs", budget: [400, 800], mid: [600, 1100], premium: [900, 1600], laborPct: 60 },
  { code: "general.cleaning", category: "general", nameEn: "Final cleaning", nameFi: "Loppusiivous", unit: "m2", budget: [4, 6], mid: [5, 8], premium: [7, 10], laborPct: 95, notes: "Per apartment floor m²." },
  { code: "general.asbestos_survey", category: "general", nameEn: "Asbestos survey", nameFi: "Asbestikartoitus", unit: "pcs", budget: [500, 900], mid: [600, 1000], premium: [700, 1200], laborPct: 100, certification: "asbestos", notes: "Required before renovation in buildings started before 1994." },
];
