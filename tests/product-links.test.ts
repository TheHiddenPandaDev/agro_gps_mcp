import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCT_PAGES } from "../src/data/product-pages.js";
import {
  REGISTER_PAGES,
  countryPageUrl,
  productPageUrl,
  productSlug,
  registersFor,
} from "../src/tools/product-links.js";

const landing = new URL("../../landing/", import.meta.url);
const hasLanding = existsSync(new URL("productos_urls.txt", landing));

function siteUrls(file: string): Set<string> {
  return new Set(readFileSync(new URL(file, landing), "utf8").split("\n").map((l) => l.trim()).filter(Boolean));
}

describe("productSlug", () => {
  it.each([
    ["DE", "Domark 10 EC", "004329-00", "domark-10-ec-004329-00"],
    ["FR", "Cuivre à 50 %", "2000123", "cuivre-a-50-2000123"],
    ["PL", "Żółty --- Środek", "R-12/2020", "zoty-srodek-r-12-2020"],
    ["ES", "ROUNDUP ULTRA PLUS", "ES-00725", "ES-00725-roundup-ultra-plus"],
    ["ES", "Microthiol Special Disperss", "11179", "11179-microthiol-special-disperss"],
  ])("%s %s", (register, name, registration, slug) => {
    expect(productSlug(register, name, registration)).toBe(slug);
  });

  it("cuts long names like the site does", () => {
    expect(productSlug("DE", "a".repeat(100), "1")).toHaveLength(80);
    expect(productSlug("ES", "b".repeat(100), "1")).toBe(`1-${"b".repeat(70)}`);
  });

  it("does not leave a dash at the cut", () => {
    expect(productSlug("DE", `${"a".repeat(79)} b`, "1").endsWith("-")).toBe(false);
  });
});

describe("links", () => {
  it("maps jurisdictions to the register they use", () => {
    expect(registersFor("ad")).toEqual(["ES", "FR"]);
    expect(registersFor("PV")).toEqual(["ES"]);
    expect(registersFor("EL")).toEqual(["GR"]);
    expect(registersFor("IT")).toEqual(["IT"]);
  });

  it("falls back to the country page for products without their own page", () => {
    expect(productPageUrl("DE", "Unknown", "none")).toBe(countryPageUrl("DE"));
    expect(countryPageUrl("GB")).toBe("https://agrogps.eu/en/tools/?utm_source=mcp");
  });

  it("tags every link with utm_source=mcp", () => {
    for (const country of [...Object.keys(REGISTER_PAGES), "IT", "XX"]) {
      expect(new URL(countryPageUrl(country)).searchParams.get("utm_source")).toBe("mcp");
    }
  });

  it("knows the pages of every country with product pages", () => {
    for (const register of Object.keys(REGISTER_PAGES)) {
      expect(PRODUCT_PAGES[register]?.length, register).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!hasLanding)("in sync with the landing", () => {
  const products = hasLanding ? siteUrls("productos_urls.txt") : new Set<string>();
  const spanish = hasLanding ? siteUrls("fitos_urls.txt") : new Set<string>();

  it("points every country index at a page that exists", () => {
    for (const [register, page] of Object.entries(REGISTER_PAGES)) {
      const all = register === "ES" ? spanish : products;
      expect(all.has(`https://agrogps.eu${page.index}`), register).toBe(true);
    }
  });

  it("lists exactly the Spanish product pages of the site", () => {
    const prefix = "https://agrogps.eu/plazos/producto/";
    const onSite = [...spanish]
      .filter((u) => u.startsWith(prefix))
      .map((u) => u.slice(prefix.length).match(/^((?:ES-)?\d+)-/)?.[1])
      .filter((r): r is string => Boolean(r))
      .sort();

    expect(PRODUCT_PAGES.ES.split("\n")).toEqual(onSite);
  });

  it("only knows product pages the site really has", () => {
    const indexed = Object.entries(PRODUCT_PAGES).filter(([r]) => r !== "ES")
      .reduce((n, [, regs]) => n + regs.split("\n").length, 0);
    const productPages = [...products].filter((u) =>
      Object.entries(REGISTER_PAGES).some(([r, p]) => r !== "ES" && u.startsWith(`https://agrogps.eu${p.index}`)
        && /\d/.test(u.slice(`https://agrogps.eu${p.index}`.length))));

    expect(indexed).toBeLessThanOrEqual(productPages.length);
  });
});
