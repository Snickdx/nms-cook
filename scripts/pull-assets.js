/**
 * Pull official NMS UI icons:
 * - Planet forage plants (Miraheze wiki)
 * - Cooking / recipe materials (NMS-Handbook PNG exports)
 *
 * Usage: node scripts/pull-assets.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_ING = path.join(ROOT, "assets", "ingredients");
const OUT_COOK = path.join(ROOT, "assets", "cooking");
const HANDBOOK_RAW =
  "https://raw.githubusercontent.com/ApexFatality93/NMS-Handbook/main/";

const ingredientIcons = {
  "Star Bulb": "SUBSTANCE.PLANT.LUSH.png",
  "Cactus Flesh": "SUBSTANCE.PLANT.DUSTY.png",
  Solanium: "SUBSTANCE.PLANT.HOT.png",
  "Frost Crystal": "SUBSTANCE.PLANT.SNOW.png",
  "Fungal Mould": "SUBSTANCE.PLANT.TOXIC.png",
  "Gamma Root": "SUBSTANCE.PLANT.RADIO.png",
  "Marrow Bulb": "SUBSTANCE.PLANT.CAVE.png",
  "Kelp Sac": "SUBSTANCE.PLANT.WATER.png",
  "Impulse Beans": "PRODUCT.PLANT.LUSHWILD.png",
  "Aloe Flesh": "PRODUCT.PLANT.DUSTWILD.png",
  Fireberry: "PRODUCT.PLANT.HOTWILD.png",
  "Frozen Tubers": "PRODUCT.PLANT.COLDWILD.png",
  "Jade Peas": "PRODUCT.PLANT.TOXWILD.png",
  Grahberry: "PRODUCT.PLANT.RADWILD.png",
  Hexaberry: "PRODUCT.PLANT.GLITCHWILD.png",
  "Heptaploid Wheat": "PRODUCT.PLANT.ALL1WILD.png",
  Sweetroot: "PRODUCT.PLANT.ALL2WILD.png",
  "Pulpy Roots": "PRODUCT.PLANT.ALL3WILD.png",
  "Wild Yeast": "PRODUCT.PLANT.POOPWILD.png",
  "Glass Grains": "PRODUCT.PLANT.COLDFARM.png",
  "Non-Toxic Mushroom": "PRODUCT.PLANT.TOXFARM.png",
  "Sievert Beans": "PRODUCT.PLANT.RADFARM.png",
  "Marrow Flesh": "PRODUCT.PLANT.CAVEWILD.png",
  "Kelp Rice": "PRODUCT.PLANT.WATERWILD.png",
};

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveWikiUrl(filename) {
  const api =
    "https://nomanssky.miraheze.org/w/api.php?action=query&titles=" +
    encodeURIComponent("File:" + filename) +
    "&prop=imageinfo&iiprop=url&format=json";
  const res = await fetch(api);
  if (!res.ok) throw new Error(`API ${res.status} for ${filename}`);
  const d = await res.json();
  const page = Object.values(d.query.pages)[0];
  if (page.missing || !page.imageinfo) return null;
  return page.imageinfo[0].url;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function localCookingName(handbookPath) {
  // textures/ui/frontend/icons/cookingproducts/product.milk.png -> product.milk.png
  return handbookPath.split("/").pop();
}

async function main() {
  fs.mkdirSync(OUT_ING, { recursive: true });
  fs.mkdirSync(OUT_COOK, { recursive: true });

  // Ensure recipes.json exists with icon paths
  const recipesPath = path.join(ROOT, "recipes.json");
  if (!fs.existsSync(recipesPath)) {
    console.log("Building recipes.json first…");
    require("child_process").execSync("node scripts/build-recipes.js", {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
  const recipes = JSON.parse(fs.readFileSync(recipesPath, "utf8"));

  /** @type {Record<string, any>} */
  const ingredients = {};
  for (const [name, file] of Object.entries(ingredientIcons)) {
    const url = await resolveWikiUrl(file);
    if (!url) {
      console.warn("missing wiki", file);
      continue;
    }
    const local = `${slug(name)}.png`;
    const dest = path.join(OUT_ING, local);
    const bytes = await download(url, dest);
    ingredients[name] = {
      file: local,
      path: `assets/ingredients/${local}`,
      sourceFile: file,
      sourceUrl: url,
      bytes,
    };
    console.log("ing", name, bytes);
  }

  /** @type {Record<string, { path: string, source: string }>} */
  const byId = {};
  /** @type {Map<string, string>} handbook icon path -> local path */
  const iconLocal = new Map();
  const uniqueIcons = [...new Set(Object.values(recipes.items).map((i) => i.icon).filter(Boolean))];

  for (const iconPath of uniqueIcons) {
    const localName = localCookingName(iconPath);
    const dest = path.join(OUT_COOK, localName);
    const localRel = `assets/cooking/${localName}`;
    if (!fs.existsSync(dest)) {
      const url = HANDBOOK_RAW + iconPath;
      try {
        const bytes = await download(url, dest);
        console.log("cook", localName, bytes);
      } catch (err) {
        console.warn("skip", iconPath, err.message);
        continue;
      }
    }
    iconLocal.set(iconPath, localRel);
  }

  for (const [id, item] of Object.entries(recipes.items)) {
    if (!item.icon) continue;
    const localPath = iconLocal.get(item.icon);
    if (!localPath) continue;
    byId[id] = {
      path: localPath,
      name: item.name,
      source: item.icon,
    };
  }

  // Also map forage ingredient display names that share cooking icons
  for (const [name, meta] of Object.entries(ingredients)) {
    // find recipe item with same name
    for (const [id, item] of Object.entries(recipes.items)) {
      if (item.name.toLowerCase() === name.toLowerCase() && !byId[id]) {
        byId[id] = { path: meta.path, name, source: meta.sourceFile };
      }
    }
  }

  const manifest = {
    title: "NMS Cook asset manifest",
    source: "Miraheze wiki + NMS-Handbook icons",
    pulledAt: new Date().toISOString(),
    ingredients,
    byId,
  };

  fs.writeFileSync(path.join(ROOT, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `wrote assets/manifest.json — ${Object.keys(ingredients).length} forage icons, ${Object.keys(byId).length} recipe item icons, ${iconLocal.size} unique cooking files`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
