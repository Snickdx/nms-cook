/**
 * Build a compact Nutrient Processor recipe graph from NMS-Handbook Cooking_Table.json
 * Usage: node scripts/build-recipes.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "recipes.json");
const SOURCE =
  "https://raw.githubusercontent.com/ApexFatality93/NMS-Handbook/main/JSON_Files/Cooking_Table.json";
const PRODUCT_SOURCE =
  "https://raw.githubusercontent.com/ApexFatality93/NMS-Handbook/main/JSON_Files/Product_Table.json";

function ddsToHandbookPath(ddsPath) {
  if (!ddsPath) return null;
  // Repo keeps TEXTURES/UI/FRONTEND/ICONS/ uppercase; filenames/folders under it are lowercase.
  const normalized = ddsPath.replace(/\\/g, "/").replace(/\.DDS$/i, ".png");
  const marker = "TEXTURES/UI/FRONTEND/ICONS/";
  const idx = normalized.toUpperCase().indexOf(marker);
  if (idx === -1) {
    return normalized
      .split("/")
      .map((part) => part.toLowerCase())
      .join("/");
  }
  const rest = normalized
    .slice(idx + marker.length)
    .split("/")
    .map((part) => part.toLowerCase())
    .join("/");
  return marker + rest;
}

async function loadTable() {
  const local = path.join(ROOT, "cooking_raw.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf8"));
  }
  console.log("Downloading Cooking_Table.json…");
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const data = await res.json();
  fs.writeFileSync(local, JSON.stringify(data));
  return data;
}

async function loadProductTable() {
  const local = path.join(ROOT, "product_raw.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf8"));
  }
  console.log("Downloading Product_Table.json…");
  const res = await fetch(PRODUCT_SOURCE);
  if (!res.ok) throw new Error(`Product download failed ${res.status}`);
  const data = await res.json();
  fs.writeFileSync(local, JSON.stringify(data));
  return data;
}

function cleanDescription(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEffectName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/^%\s*/, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Nutrient Ingestor bonus/duration catalog (community-measured from in-game UI).
 * Columns: Item,Mins,Secs,Bonus,Effect,...
 */
function loadIngestorEffects() {
  const csvPath = path.join(ROOT, "data", "ingestor-effects.csv");
  if (!fs.existsSync(csvPath)) return new Map();
  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  /** @type {Map<string, { bonus: number, durationSec: number, effectLabel: string }>} */
  const byName = new Map();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    if (cols.length < 5) continue;
    const name = cols[0].trim();
    const mins = Number(cols[1]) || 0;
    const secs = Number(cols[2]) || 0;
    const bonus = Number(String(cols[3]).replace(/,/g, ""));
    const effectLabel = String(cols[4] || "")
      .replace(/^%\s*/, "")
      .trim();
    if (!name || Number.isNaN(bonus)) continue;
    byName.set(normalizeEffectName(name), {
      bonus,
      durationSec: mins * 60 + secs,
      effectLabel,
    });
  }
  return byName;
}

/** Eat/consume bonuses from CONSUMABLEITEMTABLE + REWARDTABLE (see scripts/parse-consumable-effects.js). */
function loadConsumeEffects() {
  const jsonPath = path.join(ROOT, "data", "consume-effects.json");
  if (!fs.existsSync(jsonPath)) return new Map();
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  /** @type {Map<string, { consumeEffect: string, consumeDuration: number|null }>} */
  const byId = new Map();
  for (const [id, row] of Object.entries(data)) {
    if (!row?.consumeEffect) continue;
    byId.set(id, {
      consumeEffect: String(row.consumeEffect),
      consumeDuration:
        row.consumeDuration != null && Number.isFinite(Number(row.consumeDuration))
          ? Number(row.consumeDuration)
          : null,
    });
  }
  return byId;
}

function titleCaseProcess(name) {
  return String(name || "Cook")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const [table, productTable] = await Promise.all([loadTable(), loadProductTable()]);
  const ingestorEffects = loadIngestorEffects();
  const consumeEffects = loadConsumeEffects();
  /** @type {Record<string, { name: string, kind: string, icon: string|null, effect?: string, effectBonus?: number, effectDuration?: number, consumeEffect?: string, consumeDuration?: number, description?: string }>} */
  const items = {};
  /** @type {Record<string, { process: string, time: number, amount: number, inputs: [string, number][] }[]>} */
  const recipes = {};

  function ensureItem(id, name, kind, iconDds) {
    const icon = ddsToHandbookPath(iconDds);
    if (!items[id]) {
      items[id] = {
        name: name || id,
        kind: kind || "raw",
        icon,
      };
      return;
    }
    if (name && (!items[id].name || items[id].name === id)) items[id].name = name;
    if (icon && !items[id].icon) items[id].icon = icon;
  }

  for (const [id, prod] of Object.entries(table)) {
    const kind =
      prod.Subtitle_Text === "Raw Ingredient"
        ? "raw"
        : prod.Subtitle_Text === "Edible Product"
          ? "edible"
          : "other";
    ensureItem(id, prod.NameLower_Text || prod.Name_Text || id, kind, prod.Icon_Filename);

    const list = [];
    for (const r of prod.Recipes || []) {
      const inputs = (r.Ingredients || []).map((ing) => {
        ensureItem(
          ing.Id,
          ing.NameLower_Text || ing.Id,
          ing.Type === "Substance" ? "substance" : "raw",
          ing.Icon_Filename
        );
        return /** @type {[string, number]} */ ([ing.Id, Number(ing.Amount) || 1]);
      });
      list.push({
        process: titleCaseProcess(r.RecipeName || r.RecipeType),
        time: Number(r.TimeToMake) || 5,
        amount: Number(r.Amount) || 1,
        inputs,
      });
    }

    const seen = new Set();
    recipes[id] = list.filter((r) => {
      const key = r.process + "|" + r.inputs.map((i) => i.join("x")).join("+");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  let effectHits = 0;
  let consumeHits = 0;
  for (const id of Object.keys(items)) {
    const prod = productTable[id];
    if (prod) {
      if (prod.FoodBonusStatTypeText) items[id].effect = prod.FoodBonusStatTypeText;
      const desc = cleanDescription(prod.Description_Text);
      if (desc) items[id].description = desc;
      const cookingValue = Number(prod.CookingValue);
      if (Number.isFinite(cookingValue) && cookingValue > 0) {
        items[id].cookingValue = cookingValue;
      }
    }

    const measured = ingestorEffects.get(normalizeEffectName(items[id].name));
    if (measured) {
      items[id].effectBonus = measured.bonus;
      items[id].effectDuration = measured.durationSec;
      if (!items[id].effect && measured.effectLabel) items[id].effect = measured.effectLabel;
      effectHits++;
    }

    const consume = consumeEffects.get(id);
    if (consume) {
      items[id].consumeEffect = consume.consumeEffect;
      if (consume.consumeDuration != null) {
        items[id].consumeDuration = consume.consumeDuration;
      }
      consumeHits++;
    }
  }
  console.log(`merged ingestor effect amounts for ${effectHits} items`);
  console.log(`merged consume effects for ${consumeHits} items`);

  const meals = Object.keys(items)
    .filter((id) => items[id].kind === "edible" && (recipes[id] || []).length > 0)
    .sort((a, b) => items[a].name.localeCompare(items[b].name));

  const iconFiles = [...new Set(Object.values(items).map((i) => i.icon).filter(Boolean))];

  const out = {
    title: "No Man's Sky Nutrient Processor Recipes",
    source:
      "NMS-Handbook Cooking_Table.json + Product_Table.json; consume rewards from CONSUMABLEITEMTABLE; Nutrient Ingestor bonuses from community catalog",
    sourceUrl: SOURCE,
    productSourceUrl: PRODUCT_SOURCE,
    effectSource: "data/ingestor-effects.csv (Nutrient Ingestor UI measurements)",
    consumeEffectSource:
      "data/consume-effects.json (CONSUMABLEITEMTABLE + REWARDTABLE via scripts/parse-consumable-effects.js)",
    iconBase:
      "https://raw.githubusercontent.com/ApexFatality93/NMS-Handbook/main/",
    generatedAt: new Date().toISOString(),
    meal_count: meals.length,
    item_count: Object.keys(items).length,
    icon_count: iconFiles.length,
    items,
    recipes,
    meals,
    icons: iconFiles,
  };

  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(
    `wrote recipes.json (${kb} KB) — ${meals.length} meals, ${Object.keys(items).length} items, ${iconFiles.length} icons`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
