/**
 * Build data/consume-effects.json from CONSUMABLEITEMTABLE + REWARDTABLE.
 * Usage: node scripts/parse-consumable-effects.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const ARCHIVE =
  "https://raw.githubusercontent.com/NMSCD/nms-archive/main/6.45.1-THE_SWARM-22.June.2026/METADATA/REALITY/TABLES";

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "nmshelper/1" }, timeout: 180000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout " + url));
    });
    req.on("error", reject);
  });
}

async function ensureFile(name) {
  const dest = path.join(DATA, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return dest;
  console.log("downloading", name);
  const res = await get(`${ARCHIVE}/${name}`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${name}`);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(dest, res.body);
  console.log("saved", dest, res.body.length);
  return dest;
}

function parseConsumables(xml) {
  /** @type {Map<string, { rewardId: string, buttonLoc: string }>} */
  const byId = new Map();
  const blocks = xml.split(/value="GcConsumableItem"/);
  for (const block of blocks.slice(1)) {
    const id = (block.match(/name="ID" value="([^"]*)"/) || [])[1];
    const rewardId = (block.match(/name="RewardID" value="([^"]*)"/) || [])[1] || "";
    const buttonLoc =
      (block.match(/name="ButtonLocID" value="([^"]*)"/) || [])[1] || "";
    if (id) byId.set(id, { rewardId, buttonLoc });
  }
  return byId;
}

/** Split REWARDTABLE into entry blocks keyed by Id */
function parseRewardEntries(xml) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  const re =
    /value="GcGenericRewardTableEntry" _id="([^"]+)">/g;
  const starts = [];
  let m;
  while ((m = re.exec(xml))) {
    starts.push({ id: m[1], index: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const { id, index } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : xml.length;
    byId.set(id, xml.slice(index, end));
  }
  return byId;
}

const BUTTON_LABELS = {
  UI_CONSUME_STAM: "Sprint Overload",
  UI_CONSUME_JETPACK: "Jetpack Overload",
  UI_CONSUME_ENERGY: "Life Support Overload",
  UI_CONSUME_HEALTH: "Health Recovered",
  UI_CONSUME_HAZARD: "Hazard Protection",
  UI_CONSUME_SHIELD: "Shield Reinforced",
};

function labelFromRewardBlock(block, buttonLoc, rewardId) {
  if (BUTTON_LABELS[buttonLoc]) return BUTTON_LABELS[buttonLoc];
  if (/GcRewardFreeStamina/i.test(block)) return "Sprint Overload";
  if (/GcRewardFreeJetpack|Jetpack/i.test(block) && /Free|Overload/i.test(block))
    return "Jetpack Overload";
  if (/GcRewardEnergy/i.test(block)) return "Life Support Overload";
  if (/GcRewardHealth/i.test(block)) return "Health Recovered";
  if (/GcRewardShield/i.test(block)) return "Shield Reinforced";
  if (/Hazard/i.test(block)) return "Hazard Protection";
  if (/STAMINA|STAM/i.test(rewardId)) return "Sprint Overload";
  if (/JETPACK|JET/i.test(rewardId)) return "Jetpack Overload";
  if (/ENERGY/i.test(rewardId)) return "Life Support Overload";
  if (/HEALTH/i.test(rewardId)) return "Health Recovered";
  return null;
}

function durationFromRewardBlock(block) {
  // Prefer Duration on FreeStamina / similar
  const durMatch = block.match(
    /GcRewardFreeStamina[\s\S]*?name="Duration" value="([^"]+)"/
  ) || block.match(/name="Duration" value="([^"]+)"/);
  if (durMatch) {
    const n = Number(durMatch[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  // Energy/health sometimes use Amount as units not seconds — skip large values
  return null;
}

async function main() {
  const consPath = await ensureFile("CONSUMABLEITEMTABLE.MXML");
  const rewardPath = await ensureFile("REWARDTABLE.MXML");

  const consumables = parseConsumables(fs.readFileSync(consPath, "utf8"));
  const rewards = parseRewardEntries(fs.readFileSync(rewardPath, "utf8"));
  console.log("consumables", consumables.size, "reward entries", rewards.size);

  const recipes = JSON.parse(
    fs.readFileSync(path.join(ROOT, "recipes.json"), "utf8")
  );

  /** @type {Record<string, object>} */
  const out = {};
  const rewardStats = new Map();

  for (const id of Object.keys(recipes.items || {})) {
    const c = consumables.get(id);
    if (!c?.rewardId) continue;
    const block = rewards.get(c.rewardId) || "";
    const label = labelFromRewardBlock(block, c.buttonLoc, c.rewardId);
    if (!label) {
      if (!rewardStats.has(c.rewardId)) {
        rewardStats.set(c.rewardId, {
          count: 0,
          sample: block.slice(0, 400),
          button: c.buttonLoc,
        });
      }
      rewardStats.get(c.rewardId).count++;
      continue;
    }
    const dur = durationFromRewardBlock(block);
    const consumeEffect = dur != null ? `${label} ${dur} Sec` : label;
    out[id] = {
      name: recipes.items[id]?.name || id,
      consumeEffect,
      consumeDuration: dur,
      rewardId: c.rewardId,
    };
  }

  const outPath = path.join(DATA, "consume-effects.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("wrote", outPath, Object.keys(out).length, "items");
  console.log("SAMPLE FOOD_CG_CARM", out.FOOD_CG_CARM);

  if (rewardStats.size) {
    console.log("unmapped rewards:");
    for (const [rid, info] of [...rewardStats.entries()].sort(
      (a, b) => b[1].count - a[1].count
    )) {
      console.log(rid, info.count, info.button);
      console.log(info.sample.replace(/\s+/g, " ").slice(0, 280));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
