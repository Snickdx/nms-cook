/**
 * Scrape consume + ingest bonuses from nomansskyresources food pages.
 * Usage: node scripts/scrape-consume-effects.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const recipes = require(path.join(ROOT, "recipes.json"));

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "nmshelper-scraper/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolve, reject);
          return;
        }
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      })
      .on("error", reject);
  });
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBonuses(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  const consume = text.match(
    /Consume Bonus:\s*(.+?)\s+Nutrient Inj?estor Bonus:/i
  );
  const ingest = text.match(
    /Nutrient Inj?estor Bonus:\s*(.+?)\s+Nutrient Inj?estor Bonus &/i
  ) || text.match(
    /Nutrient Inj?estor Bonus:\s*(.+?)\s+NMSResources/i
  );

  return {
    consumeEffect: consume ? consume[1].trim() : null,
    ingestEffect: ingest ? ingest[1].trim() : null,
  };
}

async function main() {
  /** Prefer all edible / consumable cooking items */
  const ids = Object.keys(recipes.items).filter((id) => {
    const kind = recipes.items[id]?.kind;
    return kind === "edible" || kind === "raw" || (recipes.meals || []).includes(id);
  });
  const out = {};
  let ok = 0;
  let miss = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const name = recipes.items[id]?.name || id;
    const slug = slugify(name);
    const url = `https://www.nomansskyresources.com/food/${slug}`;
    try {
      const res = await get(url);
      if (res.status !== 200) {
        miss++;
        if (miss <= 15) console.log("MISS", res.status, name, slug);
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      const parsed = parseBonuses(res.body);
      if (parsed.consumeEffect || parsed.ingestEffect) {
        out[id] = { name, ...parsed };
        ok++;
        if (/caramel curiosity/i.test(name)) console.log("SAMPLE", out[id]);
      } else {
        miss++;
        if (miss <= 15) console.log("NOPARSE", name);
      }
    } catch (e) {
      miss++;
      console.log("ERR", name, e.message);
    }
    if (i % 40 === 0) console.log(`… ${i}/${ids.length} (ok ${ok})`);
    await new Promise((r) => setTimeout(r, 120));
  }

  const outPath = path.join(ROOT, "data", "consume-effects.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`wrote ${outPath} — ${ok} ok, ${miss} miss of ${ids.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
