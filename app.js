const STORAGE_KEY = "nms-cook-v1";

/** @typedef {{ label: string, type: string, category: string, cooking_ingredients: string }} Entry */
/** @typedef {{ raw: string, display: string, keys: string[], note: string|null }} ParsedIngredient */

const state = {
  /** @type {Entry[]} */
  entries: [],
  /** @type {Map<string, Entry>} */
  byLabel: new Map(),
  /** @type {{ key: string, display: string, id?: string, group?: string }[]} */
  ingredients: [],
  /** @type {Map<string, Set<string>>} normalizeKey -> planet entries */
  labelToKeys: new Map(),
  /** @type {Map<string, ParsedIngredient[]>} label -> parsed tokens */
  labelToParsed: new Map(),
  /** @type {Map<string, Entry[]>} ingredient key -> entries */
  keyToEntries: new Map(),
  /** @type {Map<string, string>} key -> display name */
  keyDisplay: new Map(),
  /** @type {Map<string, string>} normalizeKey(name) -> recipe item id */
  materialIdByKey: new Map(),
  /** @type {Map<string, string[]>} normalizeKey -> meal ids using this material */
  materialToMeals: new Map(),
  /** @type {Map<string, Set<string>>} ingredient key -> contextual obtain notes */
  keyObtainNotes: new Map(),
  /** @type {Map<string, Set<string>>} ingredient key -> source names (left side of →) */
  keyObtainFrom: new Map(),
  /** @type {Record<string, { path: string }>} */
  ingredientAssets: {},
  /** @type {Map<string, string>} normalizeKey -> asset path */
  ingredientPathByKey: new Map(),
  /** @type {Record<string, { path: string, name?: string }>} */
  iconById: {},
  /** @type {null | { items: Record<string, { name: string, kind: string, icon?: string|null, effect?: string, effectBonus?: number, effectDuration?: number, consumeEffect?: string, consumeDuration?: number, cookingValue?: number, description?: string }>, recipes: Record<string, any[]>, meals: string[] }} */
  recipeData: null,
  tab: "planets",
  selectedLabels: new Set(),
  labelFilter: "",
  ingredientFilter: "",
  selectedIngredient: "",
  includeMaterials: false,
  ingredientCategoryFilter: "",
  ingredientSort: "name",
  /** @type {Set<string>} */
  ingredientOpenCategories: new Set(["planet"]),
  recipeFilter: "",
  recipeEffectFilter: "",
  /** Recipes tab: group/filter by "consume" or "ingestor" effect */
  recipeEffectMode: "consume",
  recipeSort: "bonus-desc",
  selectedMeal: "",
  /** Recipe tab: material id shown in the right preview column */
  recipePreviewMaterialId: "",
  /** Milk guide: selected milk item id */
  selectedMilk: "",
  /** normalizeKey of ingredients the player marked as owned */
  ownedIngredients: new Set(),
  /** Recipes tab: only show meals craftable from owned ingredients */
  recipeMakeableOnly: false,
};

const els = {
  dataMeta: document.getElementById("dataMeta"),
  installBtn: document.getElementById("installBtn"),
  tabPlanets: document.getElementById("tab-planets"),
  tabIngredient: document.getElementById("tab-ingredient"),
  tabRecipes: document.getElementById("tab-recipes"),
  tabMilk: document.getElementById("tab-milk"),
  navToggle: document.getElementById("navToggle"),
  navBackdrop: document.getElementById("navBackdrop"),
  sideNav: document.getElementById("sideNav"),
  labelActions: document.getElementById("labelActions"),
  recipeActions: document.getElementById("recipeActions"),
  pickerPlanetControls: document.getElementById("pickerPlanetControls"),
  pickerIngredientControls: document.getElementById("pickerIngredientControls"),
  pickerRecipeControls: document.getElementById("pickerRecipeControls"),
  labelFilter: document.getElementById("labelFilter"),
  clearLabels: document.getElementById("clearLabels"),
  selectedPills: document.getElementById("selectedPills"),
  ingredientSearch: document.getElementById("ingredientSearch"),
  ingredientList: document.getElementById("ingredientList"),
  clearIngredient: document.getElementById("clearIngredient"),
  includeMaterials: document.getElementById("includeMaterials"),
  ingredientCategoryFilter: document.getElementById("ingredientCategoryFilter"),
  ingredientSort: document.getElementById("ingredientSort"),
  recipeFilter: document.getElementById("recipeFilter"),
  recipeEffectFilter: document.getElementById("recipeEffectFilter"),
  recipeEffectMode: document.getElementById("recipeEffectMode"),
  recipeSort: document.getElementById("recipeSort"),
  clearRecipeFilter: document.getElementById("clearRecipeFilter"),
  recipeMakeableOnly: document.getElementById("recipeMakeableOnly"),
  labelPicker: document.getElementById("labelPicker"),
  results: document.getElementById("results"),
  workspace: document.getElementById("workspace"),
  detailPane: document.getElementById("detailPane"),
  detailPreview: document.getElementById("detailPreview"),
  detailOwnSwitch: document.getElementById("detailOwnSwitch"),
  detailOwnInput: document.getElementById("detailOwnInput"),
  closePreview: document.getElementById("closePreview"),
  app: document.getElementById("app"),
};

/**
 * Animal byproduct harvest guide — which fauna genera drop each material.
 * planetTypes / planetCategories map to planets.json entries for “where to look”.
 * Sources: NMS wiki Animal Byproduct / genus pages + community biome reports.
 * @type {Record<string, { fauna: string, genera: string[], bait?: string|null, tip?: string, planetTypes?: string[], planetCategories?: string[], planetNote?: string }>}
 */
const CORE_FAUNA_PLANETS = [
  "Lush",
  "Barren",
  "Scorched",
  "Volcanic",
  "Frozen",
  "Toxic",
  "Irradiated",
  "Marsh",
];

const FAUNA_BYPRODUCTS = {
  FOOD_V_PCAT: {
    fauna: "Flower-faced plant cats",
    genera: ["Floradae"],
    tip: "Ground fauna with flower heads (starflower, tulip, foxglove, etc.). Scan Rare Ground fauna.",
    planetTypes: ["Lush", "Toxic", "Irradiated", "Marsh", "Barren"],
    planetNote: "Often reported on lush / tropical worlds, but also toxic, irradiated, and other biomes.",
  },
  FOOD_V_COW: {
    fauna: "Cow-like mammals",
    genera: ["Ungulatis", "Hexungulatis"],
    tip: "Told apart from rodents by the lack of fat, round bottoms.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Common ground herbivores on most inhabited biome types.",
  },
  FOOD_V_MILK: {
    fauna: "Antelopes & rodents",
    genera: ["Tetraceris", "Reococcyx", "Procavya"],
    tip: "Rodents often have fat, round bottoms — useful vs cow-like Fresh Milk fauna.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Common ground fauna on most inhabited biome types.",
  },
  FOOD_V_FLYER: {
    fauna: "Flying insects & protoflyers",
    genera: ["Rhopalocera", "Bosoptera", "Protocaeli"],
    tip: "Butterflies, beetles, and protoflyers — check winged / flying fauna.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Flying fauna appear on most inhabited worlds with an aerial ecosystem.",
  },
  FOOD_V_GEK: {
    fauna: "Bipedal humanoids",
    genera: ["Mogara"],
    tip: "Gek-like bipeds. Same proto cream line as Craw Milk.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Less common than cows/antelopes — keep scanning ground fauna.",
  },
  FOOD_V_BLOB: {
    fauna: "Blobs / soft blobs",
    genera: ["Lok"],
    tip: "Classic blob fauna — feed pellets for Sticky 'Honey'.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Blobs are common; some species stay in caves.",
  },
  FOOD_V_CAT: {
    fauna: "Cats & six-legged cats",
    genera: ["Felidae", "Felihex"],
    tip: "Feline ground fauna; harvest Leopard-Fruit after feeding.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Common feline ground fauna on most inhabited biomes.",
  },
  FOOD_V_CRAB: {
    fauna: "Crabs & aquatic crabs",
    genera: ["Bos", "Bosaquatica"],
    tip: "Ground and water crabs drop Crab 'Apple'.",
    planetTypes: ["Waterworld", "Marsh", "Lush", "Toxic", "Barren"],
    planetNote: "Check shorelines and waterworlds for aquatic crabs; Bos also on land.",
  },
  FOOD_V_EGG: {
    fauna: "Triceratops-like reptiles",
    genera: ["Theroma"],
    tip: "Stocky reptilian ground fauna that lay Creature Eggs.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Uncommon ground reptiles on inhabited biomes.",
  },
  FOOD_V_STRIDER: {
    fauna: "Striders / bipedal herbivores",
    genera: ["Anastomus"],
    tip: "Tall-legged ground fauna — harvest Tall Eggs.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Uncommon striders on inhabited biomes.",
  },
  FOOD_V_DIPLO: {
    fauna: "Diplos / long-necked giants",
    genera: ["Rangifae"],
    tip: "Long-necked megafauna — harvest Giant Eggs.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Look for large herbivore ecosystems.",
  },
  FOOD_V_MOLE: {
    fauna: "Moles / burrowers",
    genera: ["Talpidae"],
    tip: "Mole-like diggers — harvest Foraged Mushrooms.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Often subterranean / burrowing — check underground fauna too.",
  },
  FOOD_V_BUG: {
    fauna: "Spider-like arthropods",
    genera: ["Arthropodae"],
    tip: "Spindly ground arthropods — harvest Nourishing Slime.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Arthropod ecosystems can appear on many inhabited biomes.",
  },
  FOOD_V_REX: {
    fauna: "Tyrannosaur-like predators",
    genera: ["Tyranocae"],
    tip: "Large predatory reptiles — harvest Regis Grease.",
    planetTypes: CORE_FAUNA_PLANETS,
    planetNote: "Predator slots on inhabited biomes; also common on “prehistoric” worlds.",
  },
  FOOD_V_BONE: {
    fauna: "Bone / skeletal fauna",
    genera: ["Osteofelidae", "Protosphaeridae"],
    tip: "Bone cats and proto-spheres — harvest Bone Nuggets (churn into Bone Milk).",
    planetTypes: ["Bone Spire", "Glitch"],
    planetCategories: ["True Exotic / Weird", "Mega Exotic / Chromatic"],
    planetNote: "Especially common on bone / exotic weird worlds; also check other exotic biomes.",
  },
  FOOD_M_FIEND: {
    fauna: "Anomalous creatures",
    genera: ["Anomalous"],
    tip: "Weird / anomalous fauna — harvest Fiendish Roe after feeding.",
    planetCategories: ["True Exotic / Weird", "Mega Exotic / Chromatic"],
    planetNote: "Anomalous genus is limited to exotic / weird biomes.",
  },
  FOOD_V_ROBOT: {
    fauna: "Robotic fauna",
    genera: ["Mechanoceris", "Structurae"],
    bait: "Ion Batteries",
    tip: "Feed Ion Batteries (not pellets), then harvest Chewy Wires.",
    planetTypes: ["Fract Cube / Nanophage", "Wire Cell", "Glitch"],
    planetCategories: ["True Exotic / Weird", "Mega Exotic / Chromatic"],
    planetNote: "Robot / walking-building ecosystems often on exotic and mechanical worlds.",
  },
  FIENDCORE: {
    fauna: "Biological Horrors",
    genera: ["Biological Horror"],
    bait: null,
    tip: "Harvest Larval Cores from Biological Horror nests — do not feed pellets.",
    planetTypes: ["Dead / Airless", "Glitch"],
    planetCategories: ["True Exotic / Weird"],
    planetNote: "Look for horror nests on dead, glitch, and some exotic worlds.",
  },
};

/** Curated milk harvest guide — fauna genera from NMS wiki / Animal Byproduct data. */
const MILK_GUIDES = [
  {
    id: "FOOD_V_COW",
    fauna: "Cow-like mammals",
    genera: ["Ungulatis", "Hexungulatis"],
    method: "Feed Creature Pellets, then harvest the byproduct.",
    tip: "Unlike rodents (Wild Milk), these lack fat, round bottoms.",
    chain: ["FOOD_V_COW", "FOOD_R_CREAM", "FOOD_R_BUTTER", "FOOD_R_CHEESE"],
  },
  {
    id: "FOOD_V_MILK",
    fauna: "Antelopes & rodents",
    genera: ["Tetraceris", "Reococcyx", "Procavya"],
    method: "Feed Creature Pellets, then harvest the byproduct.",
    tip: "Rodents often have fat, round bottoms — useful vs cow-like Fresh Milk fauna.",
    chain: ["FOOD_V_MILK", "FOOD_R_CREAM", "FOOD_R_BUTTER", "FOOD_R_CHEESE"],
  },
  {
    id: "FOOD_V_FLYER",
    fauna: "Flying insects & protoflyers",
    genera: ["Rhopalocera", "Bosoptera", "Protocaeli"],
    method: "Feed Creature Pellets, then harvest the byproduct.",
    tip: "Butterflies, beetles, and protoflyers — look for winged fauna on the planet.",
    chain: ["FOOD_V_FLYER", "FOOD_R_GCREAM", "FOOD_R_GBUTTER", "FOOD_R_GCHEESE"],
  },
  {
    id: "FOOD_V_GEK",
    fauna: "Bipedal humanoids",
    genera: ["Mogara"],
    method: "Feed Creature Pellets, then harvest the byproduct.",
    tip: "Mogara are the Gek-like bipeds. Same cream line as Craw Milk (proto).",
    chain: ["FOOD_V_GEK", "FOOD_R_GCREAM", "FOOD_R_GBUTTER", "FOOD_R_GCHEESE"],
  },
  {
    id: "FOOD_R_BONEMILK",
    fauna: "Bone fauna (nuggets first)",
    genera: ["Osteofelidae", "Protosphaeridae"],
    method: "Harvest Bone Nuggets from bone fauna, then churn them in a Nutrient Processor.",
    tip: "Bone Milk is cooked, not milked. Feed pellets → Bone Nuggets → Component Churn.",
    sourceId: "FOOD_V_BONE",
    chain: ["FOOD_V_BONE", "FOOD_R_BONEMILK", "FOOD_R_BCREAM", "FOOD_R_BBUTTER", "FOOD_R_BCHEESE"],
  },
];

const INGREDIENT_CATEGORY_META = [
  { id: "planet", label: "Planet forage" },
  { id: "fauna", label: "Fauna byproducts" },
  { id: "cooking", label: "Cooking materials" },
  { id: "substance", label: "Substances" },
];

const VALID_TABS = new Set(["planets", "ingredient", "recipes", "milk"]);

function parseTab(value) {
  return VALID_TABS.has(value) ? value : "planets";
}

function normalizeKey(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[→]/g, "->")
    .trim();
}

/**
 * Split a cooking_ingredients field into searchable tokens.
 * @param {string} raw
 * @returns {ParsedIngredient[]}
 */
function parseIngredients(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(";").map((part) => {
    const trimmed = part.trim();
    const arrow = trimmed.match(/^(.+?)\s*(?:→|->)\s*(.+)$/);
    /** @type {string[]} */
    let keys = [];
    let display = trimmed;
    let note = null;

    if (arrow) {
      const left = arrow[1].trim();
      let right = arrow[2].trim();
      const where = right.match(/^(.+?)\s+(where .+)$/i);
      if (where) {
        right = where[1].trim();
        note = where[2].trim();
        display = `${left} → ${right}`;
      } else {
        display = `${left} → ${right}`;
      }
      keys = [normalizeKey(left), normalizeKey(right)].filter(Boolean);
    } else {
      const may = trimmed.match(/^(.+?)\s+(may occur.*)$/i);
      const whereOnly = trimmed.match(/^(.+?)\s+(where .+)$/i);
      if (may) {
        display = may[1].trim();
        note = may[2].trim();
        keys = [normalizeKey(display)];
      } else if (whereOnly) {
        display = whereOnly[1].trim();
        note = whereOnly[2].trim();
        keys = [normalizeKey(display)];
      } else if (/^(none of|no standard|depends on|ingredient availability|aquatic fauna|general non-dead|wild yeast may)/i.test(trimmed)) {
        display = trimmed;
        note = "contextual";
        keys = [normalizeKey(trimmed)];
      } else {
        keys = [normalizeKey(trimmed)];
      }
    }

    return { raw: trimmed, display, keys, note };
  });
}

/**
 * @param {{ entries: Entry[], entry_count?: number }} data
 */
function indexData(data) {
  state.entries = data.entries.slice();
  state.byLabel.clear();
  state.labelToKeys.clear();
  state.labelToParsed.clear();
  state.keyToEntries.clear();
  state.keyDisplay.clear();
  state.keyObtainNotes.clear();
  state.keyObtainFrom.clear();

  const ingredientSet = new Map();

  for (const entry of state.entries) {
    state.byLabel.set(entry.label, entry);
    const parsed = parseIngredients(entry.cooking_ingredients);
    state.labelToParsed.set(entry.label, parsed);
    const keys = new Set();
    for (const item of parsed) {
      for (const key of item.keys) {
        keys.add(key);
        if (!state.keyToEntries.has(key)) state.keyToEntries.set(key, []);
        state.keyToEntries.get(key).push(entry);
        if (item.note) {
          if (!state.keyObtainNotes.has(key)) state.keyObtainNotes.set(key, new Set());
          state.keyObtainNotes.get(key).add(item.note);
        }
        if (item.keys.length === 2 && item.display.includes("→") && item.keys[1] === key) {
          const fromName = item.raw.split(/\s*(?:→|->)\s*/)[0].trim();
          if (fromName) {
            if (!state.keyObtainFrom.has(key)) state.keyObtainFrom.set(key, new Set());
            state.keyObtainFrom.get(key).add(fromName);
          }
        }
        const prefer =
          item.display.includes("→") && item.keys[0] === key
            ? item.keys[0]
            : key;
        if (!state.keyDisplay.has(key) || prefer === key) {
          // Prefer short canonical names over long notes
          const candidate =
            item.keys.length > 1
              ? key === item.keys[0]
                ? item.raw.split(/\s*(?:→|->)\s*/)[0].trim()
                : item.raw.split(/\s*(?:→|->)\s*/)[1]?.replace(/\s+where .+$/i, "").trim() || item.display
              : item.display;
          const existing = state.keyDisplay.get(key);
          if (!existing || candidate.length < existing.length) {
            state.keyDisplay.set(key, candidate);
          }
        }
        if (!ingredientSet.has(key)) {
          ingredientSet.set(key, state.keyDisplay.get(key) || item.display);
        }
      }
    }
    state.labelToKeys.set(entry.label, keys);
  }

  // Drop ultra-long "none of…" style footnotes from the quick-pick list unless they are the only token
  state.ingredients = [...ingredientSet.entries()]
    .filter(([key, display]) => {
      if (display.length > 48) return false;
      if (/^(none of|no standard|depends on|ingredient availability|aquatic fauna|general non-dead)/i.test(display)) {
        return false;
      }
      return Boolean(key);
    })
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, display]) => ({ key, display, group: "planet" }));

  mergeCookingMaterials();
  syncIngredientSearchUi();
  els.dataMeta.textContent = `${state.entries.length} labels · ${state.ingredients.length} materials · ${state.recipeData?.meal_count || 0} meals`;
}

function refreshIngredientDatalist() {
  if (!els.ingredientList) return;
  els.ingredientList.innerHTML = visibleIngredients()
    .map((i) => `<option value="${escapeAttr(i.display)}"></option>`)
    .join("");
}

/** Planet forage by default; cooking materials when toggle is on. */
function visibleIngredients() {
  let list = state.includeMaterials
    ? state.ingredients
    : state.ingredients.filter((i) => i.group === "planet");
  if (state.ingredientCategoryFilter) {
    list = list.filter((i) => i.group === state.ingredientCategoryFilter);
  }
  return list;
}

function ingredientMealCount(row) {
  return (state.materialToMeals.get(row.key) || []).length;
}

function sortIngredientRows(rows) {
  const mode = state.ingredientSort;
  return rows.slice().sort((a, b) => {
    if (mode === "meals-desc") {
      const diff = ingredientMealCount(b) - ingredientMealCount(a);
      if (diff !== 0) return diff;
    }
    return a.display.localeCompare(b.display);
  });
}

function ingredientCategoryLabel(id) {
  return INGREDIENT_CATEGORY_META.find((c) => c.id === id)?.label || id;
}

const OWNED_STORAGE_KEY = "nms-cook-owned-v1";

function loadOwnedIngredients() {
  try {
    const raw = JSON.parse(localStorage.getItem(OWNED_STORAGE_KEY) || "[]");
    if (Array.isArray(raw)) state.ownedIngredients = new Set(raw.map(normalizeKey).filter(Boolean));
  } catch (_) {
    state.ownedIngredients = new Set();
  }
}

function saveOwnedIngredients() {
  try {
    localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...state.ownedIngredients]));
  } catch (_) {
    /* ignore quota */
  }
}

function isIngredientOwned(keyOrDisplay) {
  if (!keyOrDisplay) return false;
  return state.ownedIngredients.has(normalizeKey(keyOrDisplay));
}

function setIngredientOwned(keyOrDisplay, owned) {
  const key = normalizeKey(keyOrDisplay);
  if (!key) return;
  if (owned) state.ownedIngredients.add(key);
  else state.ownedIngredients.delete(key);
  saveOwnedIngredients();
}

function materialKeyFromId(id) {
  const name = state.recipeData?.items?.[id]?.name || id;
  return normalizeKey(name);
}

/** Wildcard recipe inputs — satisfied if any owned ingredient matches. */
function anyInputSatisfied(anyId) {
  if (!state.ownedIngredients.size) return false;
  const id = String(anyId || "").toUpperCase();
  for (const key of state.ownedIngredients) {
    const matId = state.materialIdByKey.get(key) || "";
    const name = state.keyDisplay.get(key) || key;
    if (id === "ANY_BONE") {
      if (matId === "FOOD_V_BONE" || /bone nugget|^bone\b/i.test(name)) return true;
    } else if (id === "ANY_FISH" || id === "ANY_FISH_RAW") {
      if (matId.startsWith("F_") || /\bfish\b|roe|crab|squid|eel/i.test(name)) return true;
    } else if (id === "ANY_FISH_COOKED") {
      if (/cooked|smoked|grilled|baked/i.test(name) && (matId.startsWith("F_") || /\bfish\b/i.test(name)))
        return true;
      if (matId.startsWith("FOOD_F_")) return true;
    } else if (state.ownedIngredients.has(normalizeKey(anyId))) {
      return true;
    }
  }
  return false;
}

/**
 * True if this leaf is in stock: marked owned, or a harvest source that yields it is owned.
 * @param {string} id recipe item id
 */
function isLeafSatisfied(id) {
  if (!id) return false;
  if (String(id).startsWith("ANY_")) return anyInputSatisfied(id);
  const key = materialKeyFromId(id);
  if (isIngredientOwned(key)) return true;
  // "Shark → Crab Apple" — owning the fauna source counts for the product leaf
  for (const src of state.keyObtainFrom.get(key) || []) {
    if (isIngredientOwned(normalizeKey(src))) return true;
  }
  return false;
}

/**
 * True if the player has this material in stock, or can cook it from owned raw leaves.
 * Intermediate cook products do not need to be marked owned.
 * @param {string} id recipe item id
 * @param {Set<string>} [stack]
 */
function canProduceMaterial(id, stack = new Set()) {
  if (!id) return false;
  if (String(id).startsWith("ANY_")) return anyInputSatisfied(id);
  // Already crafted / harvested — including optional stocked intermediates
  if (isLeafSatisfied(id)) return true;
  if (stack.has(id)) return false;
  const recipes = state.recipeData?.recipes?.[id];
  if (!recipes?.length) return false; // true leaf, not owned
  stack.add(id);
  // Each alternate recipe gets its own stack branch so siblings don't block each other
  const ok = recipes.some((r) => {
    const inputs = (r.inputs || []).filter(([ingId]) => ingId !== id);
    if (!inputs.length) return false; // self-only recipes (e.g. Wild Yeast) can't bootstrap
    const branch = new Set(stack);
    return inputs.every(([ingId]) => canProduceMaterial(ingId, branch));
  });
  stack.delete(id);
  return ok;
}

/**
 * Meal is makeable when every raw/root leaf for some cook path is in stock.
 * Cooked intermediates along the way do not need to be marked owned.
 */
function mealIsMakeable(mealId) {
  const recipes = state.recipeData?.recipes?.[mealId];
  if (!recipes?.length) return false;

  // Primary tree (matches the recipe graph): only its raw leaves matter
  const plan = buildMealPlan(mealId);
  if (plan.raw.length > 0 && plan.raw.every((row) => isLeafSatisfied(row.id))) {
    return true;
  }

  // Other top-level recipes / nested alternates from owned roots
  return recipes.some((r) =>
    (r.inputs || []).every(([ingId]) => canProduceMaterial(ingId))
  );
}

function syncIngredientSearchUi() {
  if (els.includeMaterials) els.includeMaterials.checked = state.includeMaterials;
  if (els.ingredientCategoryFilter) {
    els.ingredientCategoryFilter.value = state.ingredientCategoryFilter;
    // Fauna/cooking/substance only exist when materials are included
    const needsMats =
      state.ingredientCategoryFilter && state.ingredientCategoryFilter !== "planet";
    [...els.ingredientCategoryFilter.options].forEach((opt) => {
      if (!opt.value || opt.value === "planet") {
        opt.disabled = false;
        return;
      }
      opt.disabled = !state.includeMaterials;
    });
    if (needsMats && !state.includeMaterials) {
      state.ingredientCategoryFilter = "";
      els.ingredientCategoryFilter.value = "";
    }
  }
  if (els.ingredientSort) els.ingredientSort.value = state.ingredientSort;
  if (els.ingredientSearch) {
    els.ingredientSearch.placeholder = state.includeMaterials
      ? "Search ingredients & materials…"
      : "Search planet ingredients…";
  }
  refreshIngredientDatalist();
}

function renderIngredientPicker() {
  const q = state.ingredientFilter.trim().toLowerCase();
  const selectedKey = normalizeKey(state.selectedIngredient);
  const list = sortIngredientRows(
    visibleIngredients().filter(
      (i) => !q || i.display.toLowerCase().includes(q) || i.key.includes(normalizeKey(q))
    )
  );

  if (!list.length) {
    els.labelPicker.innerHTML = `<p class="empty">${
      state.includeMaterials
        ? "No ingredients match that filter."
        : "No planet ingredients match — turn on Include materials for cooking inputs like Larval Core."
    }</p>`;
    return;
  }

  /** @type {Map<string, typeof list>} */
  const byCategory = new Map();
  for (const row of list) {
    const cat = row.group || "cooking";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(row);
  }

  const order = INGREDIENT_CATEGORY_META.map((c) => c.id).filter((id) => byCategory.has(id));
  for (const id of byCategory.keys()) {
    if (!order.includes(id)) order.push(id);
  }

  const searching = Boolean(q);
  const selectedCat = list.find((i) => i.key === selectedKey || i.display === state.selectedIngredient)?.group;

  els.labelPicker.innerHTML = order
    .map((catId) => {
      const rows = byCategory.get(catId) || [];
      const open =
        searching ||
        state.ingredientOpenCategories.has(catId) ||
        selectedCat === catId ||
        order.length === 1;
      const tiles = rows
        .map((i) => {
          const on =
            selectedKey && (selectedKey === i.key || state.selectedIngredient === i.display)
              ? " is-on"
              : "";
          const thumb = i.id ? materialThumb(i.id, 40) : ingredientThumb(i.display);
          const meals = ingredientMealCount(i);
          const badge =
            state.ingredientSort === "meals-desc" && meals
              ? `<span class="ing-meal-count">${meals}</span>`
              : "";
          const owned = isIngredientOwned(i.key);
          return `<div class="ing-pick-row${on}">
            <button type="button" class="ing-pick" data-ing="${escapeAttr(i.display)}">
              ${thumb}
              <span class="ing-pick-name">${escapeHtml(i.display)}</span>
              ${badge}
            </button>
            <label class="have-switch" title="${owned ? "Marked as owned" : "Mark as owned"}">
              <input type="checkbox" data-own-key="${escapeAttr(i.key)}" ${owned ? "checked" : ""} role="switch" aria-label="I have ${escapeAttr(i.display)}" />
              <span class="have-track" aria-hidden="true"></span>
            </label>
          </div>`;
        })
        .join("");
      return `<details class="group group-collapse" data-ing-cat="${escapeAttr(catId)}"${open ? " open" : ""}>
        <summary class="group-title">${escapeHtml(ingredientCategoryLabel(catId))} · ${rows.length}</summary>
        <div class="ing-grid">${tiles}</div>
      </details>`;
    })
    .join("");

  els.labelPicker.querySelectorAll("details[data-ing-cat]").forEach((el) => {
    el.addEventListener("toggle", () => {
      const cat = el.getAttribute("data-ing-cat") || "";
      if (!cat) return;
      if (el.open) state.ingredientOpenCategories.add(cat);
      else state.ingredientOpenCategories.delete(cat);
    });
  });

  els.labelPicker.querySelectorAll("[data-own-key]").forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", (e) => {
      e.stopPropagation();
      const key = input.getAttribute("data-own-key") || "";
      setIngredientOwned(key, input.checked);
      const row = input.closest(".ing-pick-row");
      const label = row?.querySelector(".have-switch");
      if (label) label.title = input.checked ? "Marked as owned" : "Mark as owned";
    });
  });

  els.labelPicker.querySelectorAll("[data-ing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedIngredient = btn.getAttribute("data-ing") || "";
      writeUrl();
      els.labelPicker.querySelectorAll(".ing-pick-row.is-on").forEach((el) => el.classList.remove("is-on"));
      btn.closest(".ing-pick-row")?.classList.add("is-on");
      btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
      renderResults();
    });
  });
  highlightSelectedIngredient(Boolean(state.selectedIngredient && !q));
}

/** Merge Nutrient Processor materials (Larval Core, Crab 'Apple', milks, etc.) into the ingredient catalog. */
function mergeCookingMaterials() {
  state.materialIdByKey.clear();
  state.materialToMeals.clear();
  if (!state.recipeData?.items) return;

  const items = state.recipeData.items;
  const usedAsInput = new Set();

  for (const list of Object.values(state.recipeData.recipes || {})) {
    for (const r of list) {
      for (const [ingId] of r.inputs || []) usedAsInput.add(ingId);
    }
  }

  // Map each meal → materials in its primary cook tree
  for (const mealId of state.recipeData.meals || []) {
    const seen = new Set();
    const stack = [mealId];
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const recipe = primaryRecipe(id);
      if (!recipe) continue;
      for (const [ingId] of recipe.inputs) {
        if (!seen.has(ingId)) stack.push(ingId);
        const name = items[ingId]?.name;
        if (!name) continue;
        const key = normalizeKey(name);
        if (!state.materialToMeals.has(key)) state.materialToMeals.set(key, []);
        const meals = state.materialToMeals.get(key);
        if (!meals.includes(mealId)) meals.push(mealId);
      }
    }
  }

  const existingKeys = new Set(state.ingredients.map((i) => i.key));

  for (const [id, item] of Object.entries(items)) {
    const name = item.name;
    if (!name || name.length > 60) continue;
    const key = normalizeKey(name);
    state.materialIdByKey.set(key, id);

    const isMaterial =
      usedAsInput.has(id) || item.kind === "raw" || item.kind === "substance";
    // Skip finished meals that are never used as ingredients
    if (!isMaterial) continue;
    if (existingKeys.has(key)) {
      const row = state.ingredients.find((i) => i.key === key);
      if (row && !row.id) row.id = id;
      continue;
    }
    existingKeys.add(key);
    if (!state.keyDisplay.has(key)) state.keyDisplay.set(key, name);
    state.ingredients.push({
      key,
      display: name,
      id,
      group: FAUNA_BYPRODUCTS[id]
        ? "fauna"
        : item.kind === "substance"
          ? "substance"
          : "cooking",
    });
  }

  // Promote planet rows that are also known fauna byproducts
  for (const row of state.ingredients) {
    if (row.group !== "planet" || !row.id) continue;
    if (FAUNA_BYPRODUCTS[row.id]) row.group = "fauna";
  }

  state.ingredients.sort((a, b) => a.display.localeCompare(b.display));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @param {string} nameOrKey */
function hasIngredientIcon(nameOrKey) {
  if (!nameOrKey) return false;
  if (state.ingredientAssets[nameOrKey]?.path) return true;
  if (state.ingredientPathByKey.has(normalizeKey(nameOrKey))) return true;
  if (state.ingredientPathByKey.has(slugify(nameOrKey))) return true;
  return false;
}

/** @param {string} nameOrKey */
function resolveIngredientPath(nameOrKey) {
  if (!nameOrKey || !hasIngredientIcon(nameOrKey)) return null;
  const direct = state.ingredientAssets[nameOrKey]?.path;
  if (direct) return direct;
  return (
    state.ingredientPathByKey.get(normalizeKey(nameOrKey)) ||
    state.ingredientPathByKey.get(slugify(nameOrKey)) ||
    null
  );
}

/** @param {string} name */
function ingredientThumb(name, size = 40) {
  const id = state.materialIdByKey.get(normalizeKey(name));
  if (id && state.iconById[id]?.path) return materialThumb(id, size);
  const path = resolveIngredientPath(name);
  if (!path) return "";
  return `<img class="thumb" src="./${escapeAttr(path.replace(/^\.\//, ""))}" alt="" width="${size}" height="${size}" decoding="async" />`;
}

/** @param {string[]} keys @param {string} fallbackDisplay */
function thumbsForKeys(keys, fallbackDisplay) {
  const names = keys.map((k) => state.keyDisplay.get(k)).filter(Boolean);
  if (!names.length && fallbackDisplay) {
    names.push(...fallbackDisplay.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean));
  }
  const unique = [...new Set(names)].filter((n) => hasIngredientIcon(n));
  if (!unique.length) return "";
  return `<span class="thumb-stack">${unique.map((n) => ingredientThumb(n)).join("")}</span>`;
}

function loadAssetIndex(assets) {
  state.ingredientAssets = assets.ingredients || {};
  state.iconById = assets.byId || {};
  state.ingredientPathByKey.clear();
  for (const [name, meta] of Object.entries(state.ingredientAssets)) {
    if (!meta?.path) continue;
    const path = meta.path.replace(/^\.\//, "");
    state.ingredientPathByKey.set(normalizeKey(name), path);
    state.ingredientPathByKey.set(slugify(name), path);
  }
  // Index recipe icons by display name too for planet forage matching
  for (const meta of Object.values(state.iconById)) {
    if (!meta?.path || !meta?.name) continue;
    const path = meta.path.replace(/^\.\//, "");
    if (!state.ingredientPathByKey.has(normalizeKey(meta.name))) {
      state.ingredientPathByKey.set(normalizeKey(meta.name), path);
      state.ingredientPathByKey.set(slugify(meta.name), path);
    }
    if (!state.ingredientAssets[meta.name]) {
      state.ingredientAssets[meta.name] = { path };
    }
  }
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  const tabParam = params.get("tab");
  state.tab = parseTab(tabParam);
  const labels = (params.get("labels") || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const ing = params.get("ing") || "";
  state.selectedLabels = new Set(labels.filter((l) => state.byLabel.has(l)));
  state.selectedIngredient = ing;
  state.ingredientFilter = params.get("iq") || "";
  state.includeMaterials = params.get("mats") === "1";
  state.ingredientCategoryFilter = params.get("icat") || "";
  state.ingredientSort = params.get("isort") === "meals-desc" ? "meals-desc" : "name";
  els.labelFilter.value = params.get("q") || "";
  state.labelFilter = els.labelFilter.value;
  if (els.ingredientSearch) els.ingredientSearch.value = state.ingredientFilter;
  if (els.ingredientCategoryFilter) els.ingredientCategoryFilter.value = state.ingredientCategoryFilter;
  if (els.ingredientSort) els.ingredientSort.value = state.ingredientSort;
  syncIngredientSearchUi();
  state.recipeFilter = params.get("rq") || "";
  if (els.recipeFilter) els.recipeFilter.value = state.recipeFilter;
  state.recipeEffectFilter = params.get("re") || "";
  state.recipeEffectMode = params.get("emode") === "ingestor" ? "ingestor" : "consume";
  state.recipeSort =
    params.get("rs") === "bonus-asc" || params.get("rs") === "name"
      ? params.get("rs")
      : "bonus-desc";
  if (els.recipeEffectMode) els.recipeEffectMode.checked = state.recipeEffectMode === "ingestor";
  if (els.recipeEffectFilter) els.recipeEffectFilter.value = state.recipeEffectFilter;
  if (els.recipeSort) els.recipeSort.value = state.recipeSort;
  state.recipeMakeableOnly = params.get("make") === "1";
  if (els.recipeMakeableOnly) els.recipeMakeableOnly.checked = state.recipeMakeableOnly;
  syncRecipeEffectModeUi();
  state.selectedMeal = params.get("meal") || "";
  state.recipePreviewMaterialId = params.get("mat") || "";
  state.selectedMilk = params.get("milk") || "";
}

function writeUrl() {
  const params = new URLSearchParams();
  params.set("tab", state.tab);
  if (state.tab === "planets") {
    if (state.selectedLabels.size) {
      params.set("labels", [...state.selectedLabels].join("|"));
    }
    if (state.labelFilter.trim()) params.set("q", state.labelFilter.trim());
  } else if (state.tab === "ingredient") {
    if (state.selectedIngredient.trim()) params.set("ing", state.selectedIngredient.trim());
    if (state.ingredientFilter.trim()) params.set("iq", state.ingredientFilter.trim());
    if (state.includeMaterials) params.set("mats", "1");
    if (state.ingredientCategoryFilter) params.set("icat", state.ingredientCategoryFilter);
    if (state.ingredientSort && state.ingredientSort !== "name") params.set("isort", state.ingredientSort);
  } else if (state.tab === "recipes") {
    if (state.recipeFilter.trim()) params.set("rq", state.recipeFilter.trim());
    if (state.recipeEffectMode === "ingestor") params.set("emode", "ingestor");
    if (state.recipeEffectFilter) params.set("re", state.recipeEffectFilter);
    if (state.recipeSort && state.recipeSort !== "bonus-desc") params.set("rs", state.recipeSort);
    if (state.recipeMakeableOnly) params.set("make", "1");
    if (state.selectedMeal) params.set("meal", state.selectedMeal);
    if (state.recipePreviewMaterialId) params.set("mat", state.recipePreviewMaterialId);
  } else if (state.tab === "milk") {
    if (state.selectedMilk) params.set("milk", state.selectedMilk);
  }
  const next = `${location.pathname}?${params.toString()}`;
  history.replaceState(null, "", next);
}

function removeSelectedLabel(label) {
  state.selectedLabels.delete(label);
  writeUrl();
  renderSelectedPills();
  renderPicker();
  renderResults();
}

function renderSelectedPills() {
  const selected = [...state.selectedLabels].sort((a, b) => a.localeCompare(b));
  if (!els.selectedPills) return;
  if (state.tab !== "planets" || !selected.length) {
    els.selectedPills.hidden = true;
    if (state.tab !== "planets") els.selectedPills.innerHTML = "";
    else if (!selected.length) els.selectedPills.innerHTML = "";
    return;
  }
  els.selectedPills.hidden = false;
  els.selectedPills.innerHTML = selected
    .map((label) => {
      const entry = state.byLabel.get(label);
      const title = entry ? `${entry.type} · ${entry.category}` : label;
      return `<span class="pill" title="${escapeAttr(title)}">
        <span class="pill-text">${escapeHtml(label)}</span>
        <button type="button" class="pill-remove" data-remove-label="${escapeAttr(label)}" aria-label="Remove ${escapeAttr(label)}">×</button>
      </span>`;
    })
    .join("");

  els.selectedPills.querySelectorAll("[data-remove-label]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeSelectedLabel(btn.getAttribute("data-remove-label") || "");
    });
  });
}

function setNavOpen(open) {
  els.app.classList.toggle("nav-open", open);
  if (els.navToggle) {
    els.navToggle.setAttribute("aria-expanded", String(open));
    els.navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }
  if (els.navBackdrop) els.navBackdrop.hidden = !open;
}

function recipeItemName(id) {
  return state.recipeData?.items?.[id]?.name || id;
}

function formatEffectDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatEffectBonus(item) {
  if (!item || item.effectBonus == null || Number.isNaN(Number(item.effectBonus))) return "";
  const bonus = Number(item.effectBonus);
  const words = /words\s*translated/i.test(item.effect || "");
  const abs = Math.abs(bonus);
  const num = abs >= 1000 ? abs.toLocaleString("en-US") : String(abs);
  const sign = bonus < 0 ? "−" : "+";
  if (words) return `${sign}${num}`;
  return `${sign}${num}%`;
}

/** Nutrient Ingestor label with bonus % and duration when known. */
function formatIngestorLabel(item) {
  if (!item?.effect) return "";
  const parts = [item.effect];
  const bonus = formatEffectBonus(item);
  if (bonus) parts.push(bonus);
  const dur = formatEffectDuration(item.effectDuration);
  if (dur) parts.push(dur);
  return parts.join(" · ");
}

/** Eat/consume bonus (Sprint/Jetpack Overload, etc.). */
function formatConsumeLabel(item) {
  if (!item?.consumeEffect) return "";
  return item.consumeEffect;
}

/** Primary label for thumbs / titles: prefer consume, else ingestor. */
function formatEffectLabel(item) {
  return formatConsumeLabel(item) || formatIngestorLabel(item);
}

function formatEffectChipHtml(item) {
  const chips = [];
  const consume = formatConsumeLabel(item);
  if (consume) {
    chips.push(
      `<span class="meta-chip"><strong>Consume</strong> ${escapeHtml(consume)}</span>`
    );
  }
  const ingest = formatIngestorLabel(item);
  if (ingest) {
    chips.push(
      `<span class="meta-chip"><strong>Ingestor</strong> ${escapeHtml(ingest)}</span>`
    );
  }
  if (!chips.length) return "";
  return `<div class="meta-strip">${chips.join("")}</div>`;
}

function formatEffectBonusShort(item) {
  if (!item || item.effectBonus == null || Number.isNaN(Number(item.effectBonus))) return "";
  const bonus = Number(item.effectBonus);
  const words = /words\s*translated/i.test(item.effect || "");
  const abs = Math.abs(bonus);
  let num;
  if (abs >= 10000) num = `${Math.round(abs / 1000)}k`;
  else if (abs >= 1000) num = `${(abs / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  else num = String(abs);
  const sign = bonus < 0 ? "−" : "+";
  return words ? `${sign}${num}` : `${sign}${num}%`;
}

function mealEffectBonus(id) {
  const item = state.recipeData?.items?.[id];
  if (!item || item.effectBonus == null || Number.isNaN(Number(item.effectBonus))) return null;
  return Number(item.effectBonus);
}

function mealEffectKey(id) {
  const item = state.recipeData?.items?.[id];
  if (!item) return "";
  if (state.recipeEffectMode === "ingestor") return item.effect || "";
  return item.consumeEffect || "";
}

function syncRecipeEffectModeUi() {
  if (!els.recipeEffectMode) return;
  els.recipeEffectMode.checked = state.recipeEffectMode === "ingestor";
  const row = els.recipeEffectMode.closest(".switch-mode");
  if (!row) return;
  row.classList.toggle("is-ingestor", state.recipeEffectMode === "ingestor");
}

function listMealEffects() {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const id of state.recipeData?.meals || []) {
    const effect = mealEffectKey(id);
    if (!effect) continue;
    counts.set(effect, (counts.get(effect) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function syncRecipeEffectFilterOptions() {
  if (!els.recipeEffectFilter || !state.recipeData) return;
  const current = state.recipeEffectFilter;
  const effects = listMealEffects();
  els.recipeEffectFilter.innerHTML = `<option value="">All effects</option>${effects
    .map(
      ([name, count]) =>
        `<option value="${escapeAttr(name)}">${escapeHtml(name)} (${count})</option>`
    )
    .join("")}`;
  if (current && effects.some(([name]) => name === current)) {
    els.recipeEffectFilter.value = current;
  } else {
    state.recipeEffectFilter = "";
    els.recipeEffectFilter.value = "";
  }
}

function sortMealIds(ids) {
  const mode = state.recipeSort;
  return ids.slice().sort((a, b) => {
    if (mode === "name") {
      return recipeItemName(a).localeCompare(recipeItemName(b));
    }
    const ba = mealEffectBonus(a);
    const bb = mealEffectBonus(b);
    if (ba == null && bb == null) return recipeItemName(a).localeCompare(recipeItemName(b));
    if (ba == null) return 1;
    if (bb == null) return -1;
    const diff = mode === "bonus-asc" ? ba - bb : bb - ba;
    if (diff !== 0) return diff;
    return recipeItemName(a).localeCompare(recipeItemName(b));
  });
}

function renderMealTile(id) {
  const item = state.recipeData?.items?.[id];
  const name = item?.name || id;
  const on = state.selectedMeal === id ? " is-on" : "";
  const bonus = formatEffectBonusShort(item);
  const title = bonus ? `${name} · ${formatEffectLabel(item)}` : name;
  return `<button type="button" class="meal-tile${on}" data-meal="${escapeAttr(id)}" title="${escapeAttr(title)}">
    <span class="meal-thumb-wrap">
      ${materialThumb(id, 48)}
      ${bonus ? `<span class="meal-bonus">${escapeHtml(bonus)}</span>` : ""}
    </span>
    <span class="meal-name">${escapeHtml(name)}</span>
  </button>`;
}

function primaryRecipe(id) {
  const list = state.recipeData?.recipes?.[id];
  return list?.length ? list[0] : null;
}

function recipeDepth(id, stack = new Set()) {
  if (stack.has(id)) return 0;
  const recipe = primaryRecipe(id);
  if (!recipe) return 0;
  stack.add(id);
  const childDepths = recipe.inputs.map(([ingId]) => recipeDepth(ingId, stack));
  stack.delete(id);
  return 1 + Math.max(0, ...childDepths);
}

/**
 * Build ordered cook plan from raw materials to meal using the primary recipe path.
 * @param {string} mealId
 */
function buildMealPlan(mealId) {
  /** @type {Map<string, number>} */
  const rawNeeds = new Map();
  /** @type {{ depth: number, process: string, output: string, amount: number, inputs: { id: string, name: string, amount: number }[] }[]} */
  const steps = [];
  const cooked = new Map();

  function walk(id, qty, stack = new Set()) {
    if (!id) return;
    // Self-ref / cycles (e.g. Wild Yeast fermentation) — treat as a raw need
    if (stack.has(id)) {
      rawNeeds.set(id, (rawNeeds.get(id) || 0) + qty);
      return;
    }
    const recipe = primaryRecipe(id);
    if (!recipe) {
      rawNeeds.set(id, (rawNeeds.get(id) || 0) + qty);
      return;
    }
    // Recipe that only consumes itself — leaf
    const inputs = (recipe.inputs || []).filter(([ingId]) => ingId !== id);
    if (!inputs.length) {
      rawNeeds.set(id, (rawNeeds.get(id) || 0) + qty);
      return;
    }
    stack.add(id);
    for (const [ingId, ingAmt] of inputs) {
      walk(ingId, ingAmt * qty, stack);
    }
    stack.delete(id);
    if (!cooked.has(id)) {
      const step = {
        depth: recipeDepth(id),
        process: recipe.process,
        time: recipe.time || 5,
        output: id,
        amount: recipe.amount * qty,
        inputs: recipe.inputs.map(([ingId, ingAmt]) => ({
          id: ingId,
          name: recipeItemName(ingId),
          amount: ingAmt * qty,
        })),
      };
      cooked.set(id, step);
      steps.push(step);
    } else {
      const step = cooked.get(id);
      step.amount += recipe.amount * qty;
      for (let i = 0; i < step.inputs.length; i++) {
        step.inputs[i].amount += recipe.inputs[i][1] * qty;
      }
    }
  }

  walk(mealId, 1);
  steps.sort((a, b) => a.depth - b.depth || a.output.localeCompare(b.output));

  const raw = [...rawNeeds.entries()]
    .map(([id, amount]) => ({ id, name: recipeItemName(id), amount }))
    .sort((a, b) => a.name.localeCompare(b.name));

  /** @type {Map<number, typeof steps>} */
  const byDepth = new Map();
  for (const step of steps) {
    if (!byDepth.has(step.depth)) byDepth.set(step.depth, []);
    byDepth.get(step.depth).push(step);
  }

  return { raw, steps, byDepth, alternates: state.recipeData?.recipes?.[mealId] || [] };
}

function materialNodeSize() {
  return { width: 76, height: 96 };
}

/** @param {ReturnType<typeof buildMealPlan>} plan @param {string} mealId */
function buildRecipeGraph(plan, mealId) {
  /** @type {Map<string, { id: string, name: string, amount: number, isRaw: boolean }>} */
  const nodeById = new Map();
  /** @type {{ source: string, target: string, process: string, time: number }[]} */
  const edges = [];

  for (const r of plan.raw) {
    nodeById.set(r.id, { id: r.id, name: r.name, amount: r.amount, isRaw: true });
  }

  for (const step of plan.steps) {
    nodeById.set(step.output, {
      id: step.output,
      name: recipeItemName(step.output),
      amount: step.amount,
      isRaw: false,
    });
    for (const ing of step.inputs) {
      if (!nodeById.has(ing.id)) {
        nodeById.set(ing.id, { id: ing.id, name: ing.name, amount: ing.amount, isRaw: true });
      }
      edges.push({
        source: ing.id,
        target: step.output,
        process: step.process,
        time: step.time || 5,
      });
    }
  }

  const nodes = [...nodeById.values()].map((data) => ({
    id: data.id,
    kind: data.isRaw ? "raw" : "product",
    isFinal: data.id === mealId,
    data,
    ...materialNodeSize(),
  }));

  return { nodes, edges, mealId };
}

/** @param {ReturnType<typeof buildRecipeGraph>} graph */
function layoutRecipeGraph(graph) {
  if (typeof dagre === "undefined") return null;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 28,
    ranksep: 56,
    marginx: 20,
    marginy: 20,
  });

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of graph.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positioned = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: pos.x - node.width / 2,
      y: pos.y - node.height / 2,
    };
  });

  return {
    nodes: positioned,
    edges: graph.edges,
    width: Math.ceil((g.graph().width || 0) + 40),
    height: Math.ceil((g.graph().height || 0) + 40),
  };
}

function renderRecipeTreeNode(node) {
  const d = node.data;
  const isRaw = node.kind === "raw";
  const stocked = isRaw ? isLeafSatisfied(d.id) : null;
  const cls =
    (node.isFinal ? " is-final" : "") +
    (isRaw ? " is-raw" : " is-product") +
    (stocked === true ? " is-stocked" : "") +
    (stocked === false ? " is-unstocked" : "");
  const stockBadge =
    stocked === true
      ? `<span class="mat-stock is-yes" title="In stock">In stock</span>`
      : stocked === false
        ? `<span class="mat-stock is-no" title="Not marked in stock">Need</span>`
        : "";
  const tile = materialTile(d.id, d.name, d.amount, {
    size: 40,
    titleExtra: stocked === true ? "In stock" : stocked === false ? "Not in stock" : "",
  });
  return `<div class="recipe-tree-node${cls}">${tile}${stockBadge}</div>`;
}

function renderRecipeTreeEdges(layout) {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const paths = [];
  const labels = [];
  const seen = new Set();

  for (const edge of layout.edges) {
    const s = byId.get(edge.source);
    const t = byId.get(edge.target);
    if (!s || !t) continue;
    const x1 = s.x + s.width;
    const y1 = s.y + s.height / 2;
    const x2 = t.x;
    const y2 = t.y + t.height / 2;
    const mid = (x1 + x2) / 2;
    paths.push(`<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" />`);

    const labelKey = `${edge.source}->${edge.target}:${edge.process}`;
    if (edge.process && !seen.has(labelKey)) {
      seen.add(labelKey);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      labels.push(
        `<text x="${mx}" y="${my - 6}" class="recipe-tree-edge-label">${escapeHtml(edge.process)}</text>`
      );
    }
  }

  return `<svg class="recipe-tree-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true"><g class="recipe-tree-edge-lines">${paths.join("")}</g><g class="recipe-tree-edge-labels">${labels.join("")}</g></svg>`;
}

function renderRecipeTreeHtml(plan, mealId) {
  const graph = buildRecipeGraph(plan, mealId);
  const layout = layoutRecipeGraph(graph);

  if (!layout) {
    return `<div class="empty">Recipe layout unavailable — dagre failed to load.</div>`;
  }

  const nodesHtml = layout.nodes
    .map(
      (node) =>
        `<div class="recipe-tree-node-wrap" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px">${renderRecipeTreeNode(node)}</div>`
    )
    .join("");

  return `<div class="recipe-tree-wrap">
    <div class="recipe-tree-canvas" style="width:${layout.width}px;height:${layout.height}px">
      ${renderRecipeTreeEdges(layout)}
      ${nodesHtml}
    </div>
  </div>`;
}

function renderAltRecipeTile(recipe) {
  return `<article class="alt-recipe-tile" title="${escapeAttr(recipe.process)}">
    <div class="alt-recipe-head">
      <span class="alt-recipe-process">${escapeHtml(recipe.process)}</span>
      <span class="alt-recipe-meta">${recipe.time || 5}s</span>
    </div>
    <div class="alt-recipe-inputs mat-grid mat-grid-compact">
      ${recipe.inputs.map(([id, amt]) => materialTile(id, recipeItemName(id), amt, { size: 36 })).join("")}
    </div>
  </article>`;
}

function renderAltRecipesHtml(alts) {
  if (!alts.length) return "";
  return `<section class="cook-stage alt-recipes">
    <header class="cook-stage-head"><h3>Other recipes</h3></header>
    <div class="alt-recipe-grid">${alts.map((r) => renderAltRecipeTile(r)).join("")}</div>
  </section>`;
}

function materialThumb(nameOrId, size = 40) {
  // Prefer recipe item id lookup
  const byId = state.iconById[nameOrId];
  if (byId?.path) {
    return `<img class="thumb" src="./${escapeAttr(byId.path.replace(/^\.\//, ""))}" alt="" width="${size}" height="${size}" decoding="async" />`;
  }
  const name = state.recipeData?.items?.[nameOrId]?.name || nameOrId;
  const path = resolveIngredientPath(name);
  if (!path) return `<span class="thumb thumb-empty" aria-hidden="true"></span>`;
  return `<img class="thumb" src="./${escapeAttr(path.replace(/^\.\//, ""))}" alt="" width="${size}" height="${size}" decoding="async" />`;
}

function materialTile(id, name, amount, { size = 48, titleExtra = "" } = {}) {
  const label = name || recipeItemName(id);
  const title = titleExtra ? `${label} · ${titleExtra}` : label;
  const amt = amount != null ? `<span class="mat-amt">×${amount}</span>` : "";
  const thumb = materialThumb(id, size);
  return `<button type="button" class="mat-tile" data-material="${escapeAttr(id)}" title="${escapeAttr(title)}">
    ${thumb}
    <span class="mat-name">${escapeHtml(label)}</span>
    ${amt}
  </button>`;
}

/** Jump to Ingredient view for a recipe item id or display name. */
function openMaterial(nameOrId) {
  if (!nameOrId) return;
  const item = state.recipeData?.items?.[nameOrId];
  const name = item?.name || nameOrId;
  const key = normalizeKey(name);
  const row = state.ingredients.find((i) => i.key === key);
  if (row && row.group !== "planet") {
    state.includeMaterials = true;
    syncIngredientSearchUi();
  }
  state.selectedIngredient = name;
  state.ingredientFilter = "";
  if (els.ingredientSearch) els.ingredientSearch.value = "";
  writeUrl();
  setTab("ingredient");
}

function openRecipePreview(materialId) {
  if (!materialId) return;
  state.recipePreviewMaterialId = materialId;
  writeUrl();
  syncRecipePreviewUi();
}

function clearRecipePreview() {
  state.recipePreviewMaterialId = "";
  writeUrl();
  syncRecipePreviewUi();
}

function syncRecipePreviewUi() {
  const open =
    state.tab === "recipes" &&
    !!state.recipePreviewMaterialId &&
    !!state.recipeData?.items?.[state.recipePreviewMaterialId];
  if (els.workspace) els.workspace.classList.toggle("has-preview", open);
  if (els.detailPane) els.detailPane.hidden = !open;
  if (open) renderRecipePreview();
  else {
    if (els.detailPreview) els.detailPreview.innerHTML = "";
    syncDetailOwnSwitch("");
  }
  highlightPreviewMaterial();
}

function highlightPreviewMaterial() {
  if (!els.results) return;
  els.results.querySelectorAll("button.mat-tile.is-on").forEach((el) => {
    el.classList.remove("is-on");
  });
  const id = state.recipePreviewMaterialId;
  if (!id || state.tab !== "recipes") return;
  els.results.querySelectorAll(`button.mat-tile[data-material="${CSS.escape(id)}"]`).forEach((el) => {
    el.classList.add("is-on");
  });
}

function bindMaterialClicks(root, { mode = "navigate" } = {}) {
  root.querySelectorAll("[data-material]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-material") || "";
      if (mode === "preview" && state.tab === "recipes") openRecipePreview(id);
      else openMaterial(id);
    });
  });
}

function setTab(tab) {
  const prevTab = state.tab;
  state.tab = parseTab(tab);
  if (prevTab === "recipes" && state.tab !== "recipes") {
    state.recipePreviewMaterialId = "";
  }
  els.app.dataset.tab = state.tab;

  const tabs = [
    [els.tabPlanets, "planets"],
    [els.tabIngredient, "ingredient"],
    [els.tabRecipes, "recipes"],
    [els.tabMilk, "milk"],
  ];
  for (const [el, id] of tabs) {
    if (!el) continue;
    const on = state.tab === id;
    el.classList.toggle("is-active", on);
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  }

  if (els.pickerPlanetControls) {
    els.pickerPlanetControls.hidden = state.tab !== "planets";
  }
  if (els.pickerIngredientControls) {
    els.pickerIngredientControls.hidden = state.tab !== "ingredient";
  }
  if (els.pickerRecipeControls) {
    els.pickerRecipeControls.hidden = state.tab !== "recipes";
  }
  if (els.selectedPills && state.tab !== "planets" && state.selectedLabels.size === 0) {
    els.selectedPills.hidden = true;
  }
  setNavOpen(false);
  writeUrl();
  render();
}

function renderPicker() {
  if (state.tab === "recipes") {
    renderRecipePicker();
    return;
  }

  if (state.tab === "milk") {
    renderMilkPicker();
    return;
  }

  if (state.tab === "ingredient") {
    renderIngredientPicker();
    return;
  }

  const q = state.labelFilter.trim().toLowerCase();
  /** @type {Map<string, Entry[]>} */
  const byType = new Map();
  for (const entry of state.entries) {
    if (q && !entry.label.toLowerCase().includes(q) && !entry.type.toLowerCase().includes(q) && !entry.category.toLowerCase().includes(q)) {
      continue;
    }
    if (!byType.has(entry.type)) byType.set(entry.type, []);
    byType.get(entry.type).push(entry);
  }

  const types = [...byType.keys()].sort((a, b) => a.localeCompare(b));
  els.labelPicker.innerHTML = types
    .map((type) => {
      const rows = byType
        .get(type)
        .map((e) => {
          const checked = state.selectedLabels.has(e.label) ? "checked" : "";
          return `<label class="check-row">
            <input type="checkbox" value="${escapeAttr(e.label)}" ${checked} />
            <span>
              <span class="label-name">${escapeHtml(e.label)}</span>
              <span class="label-meta">${escapeHtml(e.category)}</span>
            </span>
          </label>`;
        })
        .join("");
      return `<div class="group"><h3 class="group-title">${escapeHtml(type)} · ${byType.get(type).length}</h3>${rows}</div>`;
    })
    .join("") || `<p class="empty">No labels match that filter.</p>`;

  els.labelPicker.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", () => {
      const label = input.value;
      if (input.checked) state.selectedLabels.add(label);
      else state.selectedLabels.delete(label);
      writeUrl();
      renderSelectedPills();
      renderResults();
    });
  });

  renderSelectedPills();
}

function resolveIngredientKey(query) {
  const q = query.trim();
  if (!q) return null;
  const key = normalizeKey(q);
  if (state.keyToEntries.has(key) || state.materialIdByKey.has(key) || state.materialToMeals.has(key)) {
    return key;
  }
  // Recipe item id passed directly
  const byId = state.recipeData?.items?.[q];
  if (byId?.name) return normalizeKey(byId.name);
  const exact = state.ingredients.find(
    (i) => i.display.toLowerCase() === q.toLowerCase() || i.key === key
  );
  if (exact) return exact.key;
  const hit = state.ingredients.find((i) => i.display.toLowerCase().includes(q.toLowerCase()));
  return hit ? hit.key : key;
}

function renderPlanetResults() {
  const selected = [...state.selectedLabels];
  if (!selected.length) {
    els.results.innerHTML = `<div class="empty">Select one or more scanner labels to list possible raw cooking ingredients findable on those worlds.</div>`;
    return;
  }

  /** @type {Map<string, { display: string, notes: Set<string>, labels: Set<string>, raws: Set<string> }>} */
  const bag = new Map();
  for (const label of selected) {
    const parsed = state.labelToParsed.get(label) || [];
    for (const item of parsed) {
      for (const key of item.keys) {
        if (!bag.has(key)) {
          bag.set(key, {
            display: state.keyDisplay.get(key) || item.display,
            notes: new Set(),
            labels: new Set(),
            raws: new Set(),
          });
        }
        const row = bag.get(key);
        row.labels.add(label);
        row.raws.add(item.raw);
        if (item.note && item.note !== "contextual") row.notes.add(item.note);
        // Prefer arrow display when present
        if (item.display.includes("→") && item.keys.includes(key)) {
          if (item.keys[0] === key) row.display = item.raw.split(/\s*(?:→|->)\s*/)[0].trim();
        }
      }
    }
  }

  /** @type {Map<string, { display: string, notes: Set<string>, labels: Set<string>, keys: string[] }>} */
  const cards = new Map();
  const consumed = new Set();
  for (const label of selected) {
    for (const item of state.labelToParsed.get(label) || []) {
      if (item.keys.length === 2 && item.display.includes("→")) {
        const id = item.keys.join("=>");
        if (consumed.has(id)) continue;
        consumed.add(id);
        item.keys.forEach((k) => consumed.add(k));
        const left = bag.get(item.keys[0]);
        const right = bag.get(item.keys[1]);
        const labels = new Set([...(left?.labels || []), ...(right?.labels || [])]);
        cards.set(id, {
          display: `${state.keyDisplay.get(item.keys[0]) || item.keys[0]} → ${state.keyDisplay.get(item.keys[1]) || item.keys[1]}`,
          notes: new Set([...(left?.notes || []), ...(right?.notes || []), ...(item.note ? [item.note] : [])]),
          labels,
          keys: item.keys,
        });
      }
    }
  }

  for (const [key, row] of bag) {
    if (consumed.has(key)) continue;
    cards.set(key, { display: row.display, notes: row.notes, labels: row.labels, keys: [key] });
  }

  const sorted = [...cards.values()].sort((a, b) => a.display.localeCompare(b.display));
  const n = selected.length;

  els.results.innerHTML = `
    <div class="results-head">
      <h2>Possible ingredients</h2>
      <p>${sorted.length} unique · from ${n} label${n === 1 ? "" : "s"}</p>
    </div>
    <div class="summary-strip">
      <span><strong>Labels:</strong> ${selected.map(escapeHtml).join(", ")}</span>
    </div>
    <div class="ing-results-grid">
      ${sorted
        .map((row) => {
          const coverage = row.labels.size;
          const partial = coverage < n;
          const note = [...row.notes].join("; ");
          const jump = row.keys[0] ? state.keyDisplay.get(row.keys[0]) || row.display : row.display;
          return `<button type="button" class="ing-tile" data-jump-ing="${escapeAttr(jump)}" title="${escapeAttr(note || row.display)}">
            <span class="ing-tile-media">${thumbsForKeys(row.keys, row.display) || `<span class="thumb thumb-empty" aria-hidden="true"></span>`}</span>
            <span class="ing-badge${partial ? " partial" : ""}">${coverage}/${n}</span>
            <span class="ing-name">${escapeHtml(row.display)}</span>
            ${note ? `<span class="ing-note">${escapeHtml(note)}</span>` : ""}
          </button>`;
        })
        .join("")}
    </div>`;

  els.results.querySelectorAll("[data-jump-ing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ing = btn.getAttribute("data-jump-ing") || "";
      state.selectedIngredient = ing;
      state.ingredientFilter = "";
      if (els.ingredientSearch) els.ingredientSearch.value = "";
      setTab("ingredient");
    });
  });
}

function materialKindLabel(kind) {
  switch (kind) {
    case "raw":
      return "Raw ingredient";
    case "substance":
      return "Refined substance";
    case "edible":
      return "Edible product";
    default:
      return "Material";
  }
}

/** Best-effort obtain hint from game item id / icon when planet data is sparse. */
function iconObtainHint(materialId, item) {
  if (!item) return null;
  if (materialId && FAUNA_BYPRODUCTS[materialId]) return null;
  const icon = (item.icon || "").toLowerCase();
  const id = (materialId || "").toLowerCase();
  if (id === "fiendcore" || icon.includes("fiendcore")) {
    return "Harvest from Biological Horror nests.";
  }
  if (icon.includes("weirdfruit") || /_v_/.test(id)) {
    return "Feed a creature, then harvest the dropped byproduct.";
  }
  if (icon.includes("product.egg") || /\/egg/.test(icon)) {
    return "Feed creatures — eggs are harvested after feeding.";
  }
  if (icon.includes("product.milk") || icon.includes("product.cream")) {
    return "Feed creatures — milk is harvested after feeding.";
  }
  if (icon.includes("meat.raw") || icon.includes("meat.offal")) {
    return "Hunt or harvest from fauna.";
  }
  if (icon.includes("deathwild")) {
    return "Forage on dead or anomalous worlds.";
  }
  if (icon.includes("stellarwild") || id.includes("stellar")) {
    return "Forage on worlds with stellar-class flora.";
  }
  if (item.kind === "substance") {
    return "Refine raw materials or gather from planetary flora and minerals.";
  }
  return null;
}

function faunaByproductGuide(materialId) {
  if (!materialId) return null;
  return FAUNA_BYPRODUCTS[materialId] || null;
}

/** Planet taxonomy entries where this fauna is worth searching. */
function entriesFromFaunaGuide(guide) {
  if (!guide) return [];
  const types = new Set(guide.planetTypes || []);
  const cats = new Set(guide.planetCategories || []);
  if (!types.size && !cats.size) return [];
  return state.entries.filter(
    (e) => (types.size && types.has(e.type)) || (cats.size && cats.has(e.category))
  );
}

function mergePlanetEntries(primary, extra) {
  /** @type {Entry[]} */
  const out = [];
  const seen = new Set();
  for (const e of [...primary, ...extra]) {
    if (seen.has(e.label)) continue;
    seen.add(e.label);
    out.push(e);
  }
  return out;
}

function buildObtainMeta(key, materialId) {
  const entries = state.keyToEntries.get(key) || [];
  const item = materialId ? state.recipeData?.items?.[materialId] : null;
  const notes = [...(state.keyObtainNotes.get(key) || [])].sort();
  const fromSources = [...(state.keyObtainFrom.get(key) || [])].sort();
  const processorRecipes = materialId ? state.recipeData?.recipes?.[materialId] || [] : [];
  const fauna = faunaByproductGuide(materialId);

  /** @type {{ label: string, value: string }[]} */
  const rows = [];
  /** @type {string[]} */
  const sourceBits = [];

  rows.push({
    label: "Type",
    value: item ? materialKindLabel(item.kind) : entries.length ? "Planet forage" : "Cooking material",
  });

  if (fauna) {
    const bait = fauna.bait === null ? null : fauna.bait || "Creature Pellets";
    if (bait) {
      sourceBits.push(`Feed ${bait}, then harvest (or use a Livestock Unit)`);
    } else if (fauna.tip) {
      sourceBits.push(fauna.tip.split("—")[0].trim().replace(/\.$/, ""));
    }
  }
  if (entries.length) sourceBits.push("Scanner labels on matching worlds");
  if (fromSources.length) sourceBits.push(`Refine ${fromSources.join(", ")}`);
  if (processorRecipes.length) sourceBits.push("Nutrient Processor");
  if (sourceBits.length) rows.push({ label: "How to obtain", value: sourceBits.join(" · ") });

  if (fromSources.length) rows.push({ label: "Refine from", value: fromSources.join(", ") });

  if (notes.length) {
    rows.push({
      label: "Notes",
      value: notes.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join("; "),
    });
  }

  if (!fauna) {
    const hint = iconObtainHint(materialId, item);
    if (hint) {
      const hasOther = entries.length || fromSources.length || processorRecipes.length;
      rows.push({ label: hasOther ? "Also" : "How to obtain", value: hint });
    } else if (!entries.length && !fromSources.length && !processorRecipes.length) {
      rows.push({
        label: "How to obtain",
        value: "Not on standard scanner labels — check fauna, anomalies, or trade.",
      });
    }
  }

  return { rows, processorRecipes, fauna };
}

function renderObtainMetaHtml(key, materialId) {
  const meta = buildObtainMeta(key, materialId);
  const stripHtml = meta.rows
    .map(
      (r) =>
        `<span class="meta-chip"><strong>${escapeHtml(r.label)}</strong> ${escapeHtml(r.value)}</span>`
    )
    .join("");

  const faunaHtml = meta.fauna?.genera?.length
    ? `<div class="obtain-fauna">
        <h4>Farm from</h4>
        <div class="genus-row">
          ${meta.fauna.genera.map((g) => `<span class="genus-chip">${escapeHtml(g)}</span>`).join("")}
        </div>
        <p class="guide-tip">${escapeHtml(meta.fauna.fauna)}${meta.fauna.tip ? ` — ${escapeHtml(meta.fauna.tip)}` : ""}</p>
      </div>`
    : "";

  const recipesHtml = meta.processorRecipes.length
    ? `<div class="meta-recipes">
        <h4>Nutrient Processor · ${meta.processorRecipes.length}</h4>
        <div class="meta-recipe-grid">
          ${meta.processorRecipes.map((r) => renderProcessorRecipeTile(r)).join("")}
        </div>
      </div>`
    : "";

  if (!stripHtml && !recipesHtml && !faunaHtml) return "";

  return `<section class="material-meta">
    <header class="cook-stage-head"><h3>Material info</h3></header>
    ${stripHtml ? `<div class="meta-strip">${stripHtml}</div>` : ""}
    ${faunaHtml}
    ${recipesHtml}
  </section>`;
}

function renderProcessorRecipeTile(recipe) {
  return `<article class="meta-recipe-tile">
    <div class="meta-recipe-head">
      <span class="meta-recipe-process">${escapeHtml(recipe.process)}</span>
      <span class="meta-recipe-meta">${recipe.time || 5}s → ×${recipe.amount || 1}</span>
    </div>
    <div class="meta-recipe-inputs">
      ${recipe.inputs.map(([id, amt]) => materialTile(id, recipeItemName(id), amt, { size: 36 })).join("")}
    </div>
  </article>`;
}

function highlightSelectedIngredient(scroll) {
  if (!els.labelPicker || !state.selectedIngredient.trim()) return;
  const selectedKey = normalizeKey(state.selectedIngredient);
  const activeBtn = [...els.labelPicker.querySelectorAll("[data-ing]")].find((btn) => {
    const name = btn.getAttribute("data-ing") || "";
    return normalizeKey(name) === selectedKey || name === state.selectedIngredient;
  });
  if (!activeBtn) return;
  const activeRow = activeBtn.closest(".ing-pick-row") || activeBtn;
  els.labelPicker.querySelectorAll(".ing-pick-row.is-on, .ing-pick.is-on").forEach((el) => {
    if (el !== activeRow && el !== activeBtn) el.classList.remove("is-on");
  });
  activeRow.classList.add("is-on");
  if (scroll) {
    requestAnimationFrame(() => {
      activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
}

function resolveMaterialDetail(nameOrId) {
  const byId = state.recipeData?.items?.[nameOrId];
  const name = byId?.name || nameOrId;
  const key = resolveIngredientKey(name);
  const materialId = byId ? nameOrId : state.materialIdByKey.get(key) || "";
  const item = materialId ? state.recipeData?.items?.[materialId] : null;
  const display = item?.name || state.keyDisplay.get(key) || name;
  const forageEntries = state.keyToEntries.get(key) || [];
  const fauna = faunaByproductGuide(materialId);
  const faunaEntries = entriesFromFaunaGuide(fauna);
  const entries = mergePlanetEntries(forageEntries, faunaEntries);
  const meals = (state.materialToMeals.get(key) || []).slice().sort((a, b) =>
    recipeItemName(a).localeCompare(recipeItemName(b))
  );
  return {
    key,
    display,
    materialId,
    item,
    entries,
    meals,
    fauna,
    planetFromFauna: faunaEntries.length > 0 && forageEntries.length === 0,
  };
}

function renderPlanetLabelsSection(entries, { fromFauna = false, faunaNote = "" } = {}) {
  if (!entries.length) return "";

  /** @type {Map<string, { categories: Set<string>, labels: Entry[] }>} */
  const byType = new Map();
  for (const e of entries) {
    if (!byType.has(e.type)) byType.set(e.type, { categories: new Set(), labels: [] });
    const block = byType.get(e.type);
    block.categories.add(e.category);
    if (!block.labels.some((x) => x.label === e.label)) block.labels.push(e);
  }

  const types = [...byType.keys()].sort((a, b) => a.localeCompare(b));
  const allCats = new Set(entries.map((e) => e.category));
  const title = fromFauna ? "Planet labels to check" : "Planet labels";
  const note = fromFauna
    ? faunaNote ||
      "Fauna are not locked to one label — use these biomes as a search shortlist."
    : "";

  return `<section class="ingredient-section">
    <header class="cook-stage-head"><h3>${escapeHtml(title)}</h3></header>
    <div class="summary-strip">
      <span><strong>Types:</strong> ${types.map(escapeHtml).join(", ")}</span>
      <span><strong>Categories:</strong> ${[...allCats].sort().map(escapeHtml).join(", ")}</span>
    </div>
    ${note ? `<p class="guide-tip">${escapeHtml(note)}</p>` : ""}
    <div class="type-block-grid">
      ${types
        .map((type) => {
          const block = byType.get(type);
          const labels = block.labels.sort((a, b) => a.label.localeCompare(b.label));
          return `<div class="type-block">
            <h3>${escapeHtml(type)}</h3>
            <p class="type-cats">${[...block.categories].sort().map(escapeHtml).join(" · ")}</p>
            <div class="label-chips">
              ${labels
                .map(
                  (e) =>
                    `<button type="button" class="chip" data-jump-label="${escapeAttr(e.label)}" title="${escapeAttr(e.category)}">${escapeHtml(e.label)}</button>`
                )
                .join("")}
            </div>
          </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderIngredientDetailHtml(ctx) {
  const { key, display, materialId, item, entries, meals, fauna, planetFromFauna } = ctx;
  if (!entries.length && !meals.length && !item) return null;

  const types = [...new Set(entries.map((e) => e.type))].sort((a, b) => a.localeCompare(b));
  const thumb = materialId ? materialThumb(materialId, 48) : ingredientThumb(display, 48);
  const kindLabel = item?.kind ? item.kind : entries.length ? "planet forage" : "cooking";
  const metaBits = [];
  if (entries.length) metaBits.push(`${entries.length} label${entries.length === 1 ? "" : "s"}`);
  if (types.length) metaBits.push(`${types.length} type${types.length === 1 ? "" : "s"}`);
  if (meals.length) metaBits.push(`${meals.length} meal${meals.length === 1 ? "" : "s"}`);

  const planetHtml = renderPlanetLabelsSection(entries, {
    fromFauna: !!planetFromFauna,
    faunaNote: fauna?.planetNote || "",
  });

  const mealsHtml = meals.length
    ? `<section class="ingredient-section meals-section">
        <header class="cook-stage-head"><h3>Used in meals · ${meals.length}</h3></header>
        <div class="meal-grid">
          ${meals
            .map((id) => {
              const name = recipeItemName(id);
              return `<button type="button" class="meal-tile" data-jump-meal="${escapeAttr(id)}" title="${escapeAttr(name)}">
                ${materialThumb(id, 48)}
                <span class="meal-name">${escapeHtml(name)}</span>
              </button>`;
            })
            .join("")}
        </div>
      </section>`
    : "";

  const isMeal =
    materialId &&
    item?.kind === "edible" &&
    (state.recipeData?.meals || []).includes(materialId);
  const recipeLinkHtml = isMeal
    ? `<p class="summary-strip"><button type="button" class="chip" data-jump-meal="${escapeAttr(materialId)}">Open recipe stages</button></p>`
    : "";
  const obtainMetaHtml = renderObtainMetaHtml(key, materialId);
  const effectHtml = formatEffectChipHtml(item);
  const primaryHtml =
    obtainMetaHtml || mealsHtml
      ? `<div class="ingredient-detail-primary">${obtainMetaHtml}${mealsHtml}</div>`
      : "";

  return `
    <div class="ingredient-detail">
      <div class="results-head">
        <div class="results-title">
          ${thumb}
          <h2>${escapeHtml(display)}</h2>
        </div>
        <p>${escapeHtml(kindLabel)}${metaBits.length ? ` · ${metaBits.map(escapeHtml).join(" · ")}` : ""}</p>
      </div>
      ${effectHtml}
      ${recipeLinkHtml}
      <div class="ingredient-detail-body">
        ${primaryHtml}
        ${planetHtml ? `<div class="ingredient-detail-secondary">${planetHtml}</div>` : ""}
      </div>
    </div>`;
}

function bindIngredientDetailActions(root, { materialMode = "navigate" } = {}) {
  bindMaterialClicks(root, { mode: materialMode });
  root.querySelectorAll("[data-jump-label]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = btn.getAttribute("data-jump-label");
      if (!label) return;
      state.selectedLabels.add(label);
      setTab("planets");
    });
  });
  root.querySelectorAll("[data-jump-meal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-jump-meal") || "";
      if (!id) return;
      state.selectedMeal = id;
      state.recipePreviewMaterialId = "";
      writeUrl();
      setTab("recipes");
    });
  });
}

function renderIngredientResults() {
  const q = state.selectedIngredient.trim();
  if (!q) {
    els.results.innerHTML = `<div class="empty">Tap an ingredient to see planet forage labels and meals that cook with it.</div>`;
    return;
  }

  const ctx = resolveMaterialDetail(q);
  const html = renderIngredientDetailHtml(ctx);
  if (!html) {
    els.results.innerHTML = `<div class="empty">No planet labels or recipes reference “${escapeHtml(q)}”.</div>`;
    return;
  }

  els.results.innerHTML = html;
  bindIngredientDetailActions(els.results);
}

function syncDetailOwnSwitch(materialId) {
  if (!els.detailOwnSwitch || !els.detailOwnInput) return;
  if (!materialId || !state.recipeData?.items?.[materialId]) {
    els.detailOwnSwitch.hidden = true;
    els.detailOwnInput.checked = false;
    els.detailOwnInput.dataset.ownKey = "";
    return;
  }
  const key = materialKeyFromId(materialId);
  const name = recipeItemName(materialId);
  const owned = isIngredientOwned(key);
  els.detailOwnSwitch.hidden = false;
  els.detailOwnSwitch.title = owned ? "Marked as in stock" : "Mark as in stock";
  els.detailOwnInput.checked = owned;
  els.detailOwnInput.dataset.ownKey = key;
  els.detailOwnInput.setAttribute("aria-label", `In stock: ${name}`);
}

function renderRecipePreview() {
  if (!els.detailPreview) return;
  const id = state.recipePreviewMaterialId;
  if (!id) {
    els.detailPreview.innerHTML = "";
    syncDetailOwnSwitch("");
    return;
  }

  const ctx = resolveMaterialDetail(id);
  const html = renderIngredientDetailHtml(ctx);
  els.detailPreview.innerHTML = html
    ? html
    : `<div class="empty">No details for this material.</div>`;
  syncDetailOwnSwitch(id);
  bindIngredientDetailActions(els.detailPreview, { materialMode: "preview" });
}

function renderRecipePicker() {
  if (!state.recipeData) {
    els.labelPicker.innerHTML = `<p class="empty">Recipe data failed to load.</p>`;
    return;
  }

  syncRecipeEffectModeUi();
  syncRecipeEffectFilterOptions();
  if (els.recipeSort) els.recipeSort.value = state.recipeSort;
  if (els.recipeMakeableOnly) els.recipeMakeableOnly.checked = state.recipeMakeableOnly;

  const q = state.recipeFilter.trim().toLowerCase();
  const effectFilter = state.recipeEffectFilter;
  const makeableOnly = state.recipeMakeableOnly;
  let meals = state.recipeData.meals.filter((id) => {
    const item = state.recipeData.items[id];
    const name = item?.name || id;
    if (q && !name.toLowerCase().includes(q)) return false;
    if (effectFilter && mealEffectKey(id) !== effectFilter) return false;
    if (makeableOnly && !mealIsMakeable(id)) return false;
    return true;
  });
  meals = sortMealIds(meals);

  if (state.selectedMeal && !meals.includes(state.selectedMeal)) {
    state.selectedMeal = meals[0] || "";
    writeUrl();
  } else if (!state.selectedMeal && meals[0]) {
    state.selectedMeal = meals[0];
    writeUrl();
  }

  if (!meals.length) {
    els.labelPicker.innerHTML = `<p class="empty">${
      makeableOnly
        ? state.ownedIngredients.size
          ? "No meals match — mark the raw/root ingredients on the Ingredient tab (intermediates are cooked, not required)."
          : "Mark raw ingredients you have on the Ingredient tab, then turn on Makeable only."
        : "No meals match that filter."
    }</p>`;
    return;
  }

  /** @type {Map<string, string[]>} */
  const byEffect = new Map();
  for (const id of meals) {
    const key = mealEffectKey(id) || "Other";
    if (!byEffect.has(key)) byEffect.set(key, []);
    byEffect.get(key).push(id);
  }

  const groups = [...byEffect.entries()].sort((a, b) => {
    if (a[0] === "Other") return 1;
    if (b[0] === "Other") return -1;
    if (state.recipeSort === "name") return a[0].localeCompare(b[0]);
    const maxA = Math.max(...a[1].map((id) => mealEffectBonus(id) ?? -Infinity));
    const maxB = Math.max(...b[1].map((id) => mealEffectBonus(id) ?? -Infinity));
    if (state.recipeSort === "bonus-asc") {
      const minA = Math.min(...a[1].map((id) => mealEffectBonus(id) ?? Infinity));
      const minB = Math.min(...b[1].map((id) => mealEffectBonus(id) ?? Infinity));
      if (minA !== minB) return minA - minB;
    } else if (maxA !== maxB) return maxB - maxA;
    return a[0].localeCompare(b[0]);
  });

  els.labelPicker.innerHTML = groups
    .map(([effect, ids]) => {
      const sorted = sortMealIds(ids);
      return `<div class="group">
        <h3 class="group-title">${escapeHtml(effect)} · ${sorted.length}</h3>
        <div class="meal-grid">${sorted.map(renderMealTile).join("")}</div>
      </div>`;
    })
    .join("");

  els.labelPicker.querySelectorAll("[data-meal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedMeal = btn.getAttribute("data-meal") || "";
      state.recipePreviewMaterialId = "";
      writeUrl();
      renderPicker();
      renderResults();
    });
  });
}

function renderRecipeResults() {
  if (!state.recipeData) {
    els.results.innerHTML = `<div class="empty">Recipe catalogue unavailable.</div>`;
    return;
  }
  const mealId = state.selectedMeal;
  if (!mealId || !state.recipeData.items[mealId]) {
    els.results.innerHTML = `<div class="empty">Select a meal to see cooking stages from raw materials.</div>`;
    return;
  }

  const meal = state.recipeData.items[mealId];
  const mealName = recipeItemName(mealId);
  const plan = buildMealPlan(mealId);
  const treeHtml = renderRecipeTreeHtml(plan, mealId);
  const altHtml = renderAltRecipesHtml(plan.alternates.slice(1));
  const effectHtml = formatEffectChipHtml(meal);

  els.results.innerHTML = `
    <div class="results-head">
      <div class="results-title">
        ${materialThumb(mealId, 48)}
        <h2>${escapeHtml(mealName)}</h2>
      </div>
      <p>${plan.raw.length} raw · ${plan.steps.length} cook step${plan.steps.length === 1 ? "" : "s"}</p>
    </div>
    ${effectHtml}
    <p class="summary-strip">Primary path laid out left → right. Tap any material for details.</p>
    ${treeHtml}
    ${altHtml}`;

  bindMaterialClicks(els.results, { mode: "preview" });
  syncRecipePreviewUi();
}

function milkGuideById(id) {
  return MILK_GUIDES.find((g) => g.id === id) || null;
}

function renderMilkPicker() {
  if (!state.selectedMilk || !milkGuideById(state.selectedMilk)) {
    state.selectedMilk = MILK_GUIDES[0]?.id || "";
  }

  els.labelPicker.innerHTML = `<div class="group">
    <h3 class="group-title">Milk types · ${MILK_GUIDES.length}</h3>
    <div class="meal-grid">
      ${MILK_GUIDES.map((g) => {
        const name = recipeItemName(g.id);
        const on = state.selectedMilk === g.id ? " is-on" : "";
        return `<button type="button" class="meal-tile${on}" data-milk="${escapeAttr(g.id)}" title="${escapeAttr(name)}">
          ${materialThumb(g.id, 48)}
          <span class="meal-name">${escapeHtml(name)}</span>
          <span class="meal-sub">${escapeHtml(g.fauna)}</span>
        </button>`;
      }).join("")}
    </div>
  </div>`;

  els.labelPicker.querySelectorAll("[data-milk]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedMilk = btn.getAttribute("data-milk") || "";
      writeUrl();
      renderPicker();
      renderResults();
    });
  });
}

function renderMilkChainHtml(chain) {
  if (!chain?.length) return "";
  return `<div class="milk-chain" aria-label="Cooking chain">
    ${chain
      .map((id, i) => {
        const tile = materialTile(id, recipeItemName(id), null, { size: 40 });
        const arrow = i < chain.length - 1 ? `<span class="milk-chain-arrow" aria-hidden="true">→</span>` : "";
        return `${tile}${arrow}`;
      })
      .join("")}
  </div>`;
}

function renderMilkResults() {
  const guide = milkGuideById(state.selectedMilk);
  if (!guide) {
    els.results.innerHTML = `<div class="empty">Select a milk type to see how to harvest it.</div>`;
    return;
  }

  const item = state.recipeData?.items?.[guide.id];
  const name = recipeItemName(guide.id);
  const sourceId = guide.sourceId;
  const sourceName = sourceId ? recipeItemName(sourceId) : null;

  els.results.innerHTML = `
    <div class="guide-page">
      <div class="results-head">
        <div class="results-title">
          ${materialThumb(guide.id, 48)}
          <h2>${escapeHtml(name)}</h2>
        </div>
        <p>${escapeHtml(guide.fauna)}</p>
      </div>
      ${formatEffectChipHtml(item)}

      <section class="guide-section">
        <header class="cook-stage-head"><h3>How to get it</h3></header>
        <p class="guide-copy">${escapeHtml(guide.method)}</p>
        ${
          sourceId
            ? `<div class="milk-source">
                ${materialTile(sourceId, sourceName, null, { size: 40 })}
                <span class="guide-copy">Process ${escapeHtml(sourceName)} → ${escapeHtml(name)}</span>
              </div>`
            : ""
        }
      </section>

      <section class="guide-section">
        <header class="cook-stage-head"><h3>Fauna genera</h3></header>
        <div class="genus-row">
          ${guide.genera.map((g) => `<span class="genus-chip">${escapeHtml(g)}</span>`).join("")}
        </div>
        ${guide.tip ? `<p class="guide-tip">${escapeHtml(guide.tip)}</p>` : ""}
      </section>

      <section class="guide-section">
        <header class="cook-stage-head"><h3>Cooking line</h3></header>
        <p class="guide-copy">Typical Nutrient Processor chain from this milk family.</p>
        ${renderMilkChainHtml(guide.chain)}
      </section>

      <p class="summary-strip">
        <button type="button" class="chip" data-jump-ing="${escapeAttr(name)}">Open in Ingredient</button>
        ${
          item?.kind === "edible" && (state.recipeData?.meals || []).includes(guide.id)
            ? `<button type="button" class="chip" data-jump-meal="${escapeAttr(guide.id)}">Open recipe</button>`
            : ""
        }
      </p>
    </div>`;

  bindMaterialClicks(els.results);
  els.results.querySelectorAll("[data-jump-ing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = btn.getAttribute("data-jump-ing") || "";
      if (!n) return;
      openMaterial(n);
    });
  });
  els.results.querySelectorAll("[data-jump-meal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-jump-meal") || "";
      if (!id) return;
      state.selectedMeal = id;
      state.recipePreviewMaterialId = "";
      writeUrl();
      setTab("recipes");
    });
  });
}

function renderResults() {
  if (state.tab === "planets") renderPlanetResults();
  else if (state.tab === "ingredient") renderIngredientResults();
  else if (state.tab === "milk") renderMilkResults();
  else renderRecipeResults();
}

function render() {
  renderSelectedPills();
  renderPicker();
  renderResults();
  if (state.tab !== "recipes") syncRecipePreviewUi();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function boot() {
  const [res, assetRes, recipeRes] = await Promise.all([
    fetch("planets.json", { cache: "no-cache" }),
    fetch("assets/manifest.json", { cache: "no-cache" }).catch(() => null),
    fetch("recipes.json", { cache: "no-cache" }).catch(() => null),
  ]);
  if (!res.ok) throw new Error(`Failed to load planets.json (${res.status})`);
  const data = await res.json();
  if (assetRes?.ok) {
    loadAssetIndex(await assetRes.json());
  }
  if (recipeRes?.ok) {
    state.recipeData = await recipeRes.json();
  }
  indexData(data);
  loadOwnedIngredients();
  readUrl();
  if (state.selectedMeal && state.recipeData && !state.recipeData.items[state.selectedMeal]) {
    state.selectedMeal = "";
  }
  if (
    state.recipePreviewMaterialId &&
    state.recipeData &&
    !state.recipeData.items[state.recipePreviewMaterialId]
  ) {
    state.recipePreviewMaterialId = "";
  }
  if (state.selectedMilk && !milkGuideById(state.selectedMilk)) {
    state.selectedMilk = "";
  }
  setTab(state.tab);

  els.tabPlanets.addEventListener("click", () => setTab("planets"));
  els.tabIngredient.addEventListener("click", () => setTab("ingredient"));
  if (els.tabRecipes) els.tabRecipes.addEventListener("click", () => setTab("recipes"));
  if (els.tabMilk) els.tabMilk.addEventListener("click", () => setTab("milk"));

  if (els.navToggle) {
    els.navToggle.addEventListener("click", () => {
      setNavOpen(!els.app.classList.contains("nav-open"));
    });
  }
  if (els.navBackdrop) {
    els.navBackdrop.addEventListener("click", () => setNavOpen(false));
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNavOpen(false);
  });

  els.labelFilter.addEventListener(
    "input",
    debounce(() => {
      state.labelFilter = els.labelFilter.value;
      writeUrl();
      renderPicker();
    }, 120)
  );

  els.clearLabels.addEventListener("click", () => {
    state.selectedLabels.clear();
    writeUrl();
    render();
  });

  els.ingredientSearch.addEventListener(
    "input",
    debounce(() => {
      state.ingredientFilter = els.ingredientSearch.value;
      writeUrl();
      renderPicker();
    }, 120)
  );

  els.ingredientSearch.addEventListener("change", () => {
    state.ingredientFilter = els.ingredientSearch.value;
    writeUrl();
    renderPicker();
  });

  els.clearIngredient.addEventListener("click", () => {
    state.ingredientFilter = "";
    state.ingredientCategoryFilter = "";
    state.ingredientSort = "name";
    els.ingredientSearch.value = "";
    if (els.ingredientCategoryFilter) els.ingredientCategoryFilter.value = "";
    if (els.ingredientSort) els.ingredientSort.value = "name";
    writeUrl();
    renderPicker();
  });

  if (els.includeMaterials) {
    els.includeMaterials.addEventListener("change", () => {
      state.includeMaterials = els.includeMaterials.checked;
      if (state.includeMaterials) {
        for (const cat of ["fauna", "cooking", "substance"]) {
          state.ingredientOpenCategories.add(cat);
        }
      }
      syncIngredientSearchUi();
      writeUrl();
      render();
    });
  }

  if (els.ingredientCategoryFilter) {
    els.ingredientCategoryFilter.addEventListener("change", () => {
      state.ingredientCategoryFilter = els.ingredientCategoryFilter.value;
      if (state.ingredientCategoryFilter && state.ingredientCategoryFilter !== "planet") {
        state.includeMaterials = true;
      }
      if (state.ingredientCategoryFilter) {
        state.ingredientOpenCategories.add(state.ingredientCategoryFilter);
      }
      syncIngredientSearchUi();
      writeUrl();
      renderPicker();
    });
  }

  if (els.ingredientSort) {
    els.ingredientSort.addEventListener("change", () => {
      state.ingredientSort = els.ingredientSort.value || "name";
      writeUrl();
      renderPicker();
    });
  }

  if (els.recipeFilter) {
    els.recipeFilter.addEventListener(
      "input",
      debounce(() => {
        state.recipeFilter = els.recipeFilter.value;
        writeUrl();
        renderPicker();
      }, 120)
    );
  }

  if (els.recipeEffectMode) {
    els.recipeEffectMode.addEventListener("change", () => {
      state.recipeEffectMode = els.recipeEffectMode.checked ? "ingestor" : "consume";
      state.recipeEffectFilter = "";
      if (els.recipeEffectFilter) els.recipeEffectFilter.value = "";
      syncRecipeEffectModeUi();
      writeUrl();
      renderPicker();
    });
  }

  if (els.recipeEffectFilter) {
    els.recipeEffectFilter.addEventListener("change", () => {
      state.recipeEffectFilter = els.recipeEffectFilter.value;
      writeUrl();
      renderPicker();
    });
  }

  if (els.recipeSort) {
    els.recipeSort.addEventListener("change", () => {
      state.recipeSort = els.recipeSort.value || "bonus-desc";
      writeUrl();
      renderPicker();
    });
  }

  if (els.clearRecipeFilter) {
    els.clearRecipeFilter.addEventListener("click", () => {
      state.recipeFilter = "";
      state.recipeEffectFilter = "";
      state.recipeEffectMode = "consume";
      state.recipeSort = "bonus-desc";
      state.recipeMakeableOnly = false;
      if (els.recipeFilter) els.recipeFilter.value = "";
      if (els.recipeEffectFilter) els.recipeEffectFilter.value = "";
      if (els.recipeSort) els.recipeSort.value = "bonus-desc";
      if (els.recipeMakeableOnly) els.recipeMakeableOnly.checked = false;
      syncRecipeEffectModeUi();
      writeUrl();
      renderPicker();
    });
  }

  if (els.recipeMakeableOnly) {
    els.recipeMakeableOnly.addEventListener("change", () => {
      state.recipeMakeableOnly = els.recipeMakeableOnly.checked;
      writeUrl();
      renderPicker();
      renderResults();
    });
  }

  if (els.closePreview) {
    els.closePreview.addEventListener("click", () => clearRecipePreview());
  }

  if (els.detailOwnInput) {
    els.detailOwnInput.addEventListener("change", () => {
      const key = els.detailOwnInput.dataset.ownKey || "";
      if (!key) return;
      setIngredientOwned(key, els.detailOwnInput.checked);
      if (els.detailOwnSwitch) {
        els.detailOwnSwitch.title = els.detailOwnInput.checked
          ? "Marked as in stock"
          : "Mark as in stock";
      }
      if (state.tab === "recipes") {
        if (state.recipeMakeableOnly) renderPicker();
        renderResults();
        syncRecipePreviewUi();
      }
    });
  }

  window.addEventListener("popstate", () => {
    readUrl();
    setTab(state.tab);
  });

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (_) {
      /* offline optional */
    }
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });

  // Restore last session only if URL empty
  const params = new URLSearchParams(location.search);
  if (![...params.keys()].length) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.tab) state.tab = saved.tab;
      if (Array.isArray(saved?.labels)) state.selectedLabels = new Set(saved.labels.filter((l) => state.byLabel.has(l)));
      if (saved?.ing) {
        state.selectedIngredient = saved.ing;
      }
      if (saved?.iq) {
        state.ingredientFilter = saved.iq;
        els.ingredientSearch.value = saved.iq;
      }
      setTab(state.tab);
    } catch (_) {
      /* ignore */
    }
  }

  window.addEventListener("beforeunload", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tab: state.tab,
        labels: [...state.selectedLabels],
        ing: state.selectedIngredient,
        iq: state.ingredientFilter,
      })
    );
  });
}

boot().catch((err) => {
  els.dataMeta.textContent = "Failed to load data";
  els.results.innerHTML = `<div class="empty">${escapeHtml(err.message)}. Serve this folder over HTTP so planets.json can load.</div>`;
});
