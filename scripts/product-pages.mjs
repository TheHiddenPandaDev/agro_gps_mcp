import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const landing = process.argv[2] ?? join(here, "..", "..", "landing");
const target = join(here, "..", "src", "data", "product-pages.ts");
const SITE = "https://agrogps.eu";

const { REGISTER_PAGES, productSlug } = await import(join(here, "..", "build", "tools", "product-links.js"));

function urls(file) {
  return new Set(
    readFileSync(join(landing, file), "utf8").split("\n").map((l) => l.trim().replace(SITE, "")).filter(Boolean),
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function productNames(country) {
  const file = join(landing, "data", `phyto_${country.toLowerCase()}.csv.gz`);
  const rows = parseCsv(gunzipSync(readFileSync(file)).toString("utf8"));
  const names = new Map();
  for (const r of rows) if (!names.has(r.registration_number)) names.set(r.registration_number, r.name);
  return names;
}

const products = urls("productos_urls.txt");
const spanish = urls("fitos_urls.txt");
const out = {};

for (const [country, page] of Object.entries(REGISTER_PAGES)) {
  if (country === "ES") {
    const prefix = page.index;
    out.ES = [...spanish]
      .filter((u) => u.startsWith(prefix) && u !== prefix)
      .map((u) => u.slice(prefix.length).match(/^((?:ES-)?\d+)-/)?.[1])
      .filter(Boolean)
      .sort();
    continue;
  }
  const regs = [];
  for (const [reg, name] of productNames(country)) {
    if (products.has(page.index + productSlug(country, name, reg) + "/")) regs.push(reg);
  }
  out[country] = regs.sort();
}

const body = Object.entries(out).map(([c, regs]) => `  ${c}: ${JSON.stringify(regs.join("\n"))},`).join("\n");
writeFileSync(target, `export const PRODUCT_PAGES: Record<string, string> = {\n${body}\n};\n`);
console.error(Object.entries(out).map(([c, r]) => `${c}:${r.length}`).join(" "));
