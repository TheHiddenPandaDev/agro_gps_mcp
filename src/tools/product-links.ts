import { PRODUCT_PAGES } from "../data/product-pages.js";

export const SITE_URL = "https://agrogps.eu";
export const APP_URL = `${SITE_URL}/app/`;
const UTM = "utm_source=mcp";
const DEFAULT_TOOLS_PAGE = "/en/tools/";
const SPANISH_SLUG_LENGTH = 70;
const SLUG_LENGTH = 80;

export const REGISTER_PAGES: Record<string, { index: string }> = {
  ES: { index: "/plazos/producto/" },
  DE: { index: "/de/wartezeit/" },
  AT: { index: "/de/wartezeit-oesterreich/" },
  FR: { index: "/fr/delai-avant-recolte/" },
  PT: { index: "/pt/intervalo-de-seguranca/" },
  NL: { index: "/nl/gewasbeschermingsmiddelen/" },
  PL: { index: "/pl/srodki-ochrony-roslin/" },
  CZ: { index: "/cs/pripravky-na-ochranu-rostlin/" },
  SK: { index: "/sk/pripravky-na-ochranu-rastlin/" },
  LT: { index: "/lt/augalu-apsaugos-produktai/" },
  EE: { index: "/et/taimekaitsevahendid/" },
  FI: { index: "/fi/kasvinsuojeluaineet/" },
  SE: { index: "/sv/karenstid/" },
};

const TOOLS_PAGES: Record<string, string> = {
  AD: "/ca/eines/",
  IT: "/it/strumenti/",
  BE: "/fr/outils/",
  LU: "/fr/outils/",
  CH: "/de/rechner/",
  LI: "/de/rechner/",
  DK: "/da/beregnere/",
  NO: "/nb/kalkulatorer/",
  IS: "/is/reiknivelar/",
  HU: "/hu/kalkulatorok/",
  RO: "/ro/calculatoare/",
  GR: "/el/ergaleia/",
  CY: "/el/ergaleia/",
  SI: "/sl/kalkulatorji/",
  HR: "/hr/kalkulatori/",
  BG: "/bg/kalkulatori/",
  LV: "/lv/kalkulatori/",
};

const REGISTER_ALIASES: Record<string, string[]> = {
  AD: ["ES", "FR"],
  PV: ["ES"],
  NA: ["ES"],
  EL: ["GR"],
  UK: ["GB"],
  XI: ["GB"],
  NIR: ["GB"],
  "GB-NIR": ["GB"],
};

const pageSets = new Map<string, Set<string>>();

function pagesOf(register: string): Set<string> {
  let pages = pageSets.get(register);
  if (!pages) {
    pages = new Set((PRODUCT_PAGES[register] ?? "").split("\n").filter(Boolean));
    pageSets.set(register, pages);
  }
  return pages;
}

function slugify(text: string, length: number): string {
  const ascii = text.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  return ascii
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .replace(/-{2,}/g, "-")
    .slice(0, length);
}

export function productSlug(register: string, name: string, registration: string): string {
  if (register === "ES") return `${registration}-${slugify(name, SPANISH_SLUG_LENGTH)}`;
  return slugify(`${name}-${registration}`, SLUG_LENGTH).replace(/^-+|-+$/g, "");
}

export function registersFor(country: string): string[] {
  const code = country.trim().toUpperCase();
  return REGISTER_ALIASES[code] ?? [code];
}

function withUtm(path: string): string {
  return `${SITE_URL}${path}?${UTM}`;
}

export function countryPageUrl(country: string): string {
  const registers = registersFor(country);
  const indexed = registers.find((r) => REGISTER_PAGES[r]);
  if (indexed) return withUtm(REGISTER_PAGES[indexed].index);
  return withUtm(TOOLS_PAGES[country.trim().toUpperCase()] ?? DEFAULT_TOOLS_PAGE);
}

export function productPageUrl(country: string, name: string, registration: string, register?: string): string {
  const candidates = register ? [register.toUpperCase()] : registersFor(country);
  for (const r of candidates) {
    const page = REGISTER_PAGES[r];
    if (page && pagesOf(r).has(registration)) return withUtm(page.index + productSlug(r, name, registration) + "/");
  }
  return countryPageUrl(country);
}
