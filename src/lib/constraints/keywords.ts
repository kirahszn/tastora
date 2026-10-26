// Keyword tables and whole-word matching for dish names and venue tags.
// Qloo gives dish *names* only (no ingredients), so these lists only ever flag dishes or add
// evidence; they never prove a dish or venue is safe.

/** Lower-case and collapse whitespace. */
export function normalizeTerm(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const patternCache = new Map<string, RegExp>();

/**
 * Case-insensitive whole-word match that tolerates a plural "s"/"es" and space/hyphen variants,
 * so "peanut" matches "Peanuts" and "peanut-butter", but "pea" does not match "peanut".
 */
export function containsKeyword(text: string, keyword: string): boolean {
  const key = normalizeTerm(keyword);
  if (!key) return false;
  let re = patternCache.get(key);
  if (!re) {
    const body = key.split(" ").map(escapeRegExp).join("[\\s-]+");
    re = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu");
    patternCache.set(key, re);
  }
  return re.test(text);
}

/** First keyword found in `text`, or null. */
export function findKeyword(text: string, keywords: readonly string[]): string | null {
  return keywords.find((k) => containsKeyword(text, k)) ?? null;
}

// --- Allergens ---------------------------------------------------------------------------------

export interface AllergenGroup {
  key: string;
  /** Profile terms that select this group. */
  aliases: readonly string[];
  /** Words in a dish name that suggest the allergen. */
  dishKeywords: readonly string[];
  /**
   * Dish names commonly made with the allergen even though the name doesn't say so
   * (e.g. suya: peanut spice). Recipes vary and are not verified.
   */
  commonDishes: readonly string[];
  /** Venue-level tags worth mentioning for this allergen (positive note only, never "safe"). */
  venueTags: readonly string[];
}

const MILK_WORDS = [
  "milk", "dairy", "cheese", "cheesecake", "butter", "buttermilk", "cream", "yogurt", "yoghurt",
  "ghee", "paneer", "mozzarella", "parmesan", "parm", "ricotta", "burrata", "mascarpone",
];
const EGG_WORDS = ["egg", "omelet", "omelette", "frittata", "mayonnaise", "mayo", "meringue", "aioli"];
const WHEAT_WORDS = [
  "wheat", "gluten", "flour", "bread", "pasta", "noodle", "spaghetti", "linguine", "linguini",
  "lasagna", "ravioli", "pizza", "sandwich", "couscous", "seitan",
];
const FISH_WORDS = [
  "fish", "salmon", "tuna", "cod", "tilapia", "anchovy", "anchovies", "sardine", "trout",
  "halibut", "snapper", "catfish", "mackerel", "herring", "lox", "bass", "sashimi", "yellowtail",
];
// Molluscs (squid, octopus, clams…) are grouped with crustaceans, as US menus usually do.
const SHELLFISH_WORDS = [
  "shellfish", "shrimp", "prawn", "crab", "lobster", "crayfish", "crawfish", "langoustine",
  "gambas", "scallop", "clam", "mussel", "oyster", "squid", "calamari", "octopus",
];

export const ALLERGEN_GROUPS: readonly AllergenGroup[] = [
  {
    key: "peanut",
    aliases: ["peanut", "groundnut", "nuts", "nut"],
    dishKeywords: ["peanut", "groundnut"],
    commonDishes: [
      "suya", "satay", "groundnut stew", "maafe", "mafe", "domoda", "pad thai", "kung pao",
    ],
    venueTags: ["Peanut free"],
  },
  {
    key: "tree nuts",
    aliases: ["tree nut", "nuts", "nut"],
    dishKeywords: [
      "tree nut", "nut", "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut",
      "macadamia", "brazil nut", "pine nut", "praline", "marzipan",
    ],
    commonDishes: ["pesto", "baklava"],
    venueTags: [],
  },
  {
    key: "shellfish",
    aliases: ["shellfish", "crustacean", "seafood"],
    dishKeywords: SHELLFISH_WORDS,
    commonDishes: [],
    venueTags: [],
  },
  { key: "fish", aliases: ["fish", "seafood"], dishKeywords: FISH_WORDS, commonDishes: [], venueTags: [] },
  { key: "egg", aliases: ["egg"], dishKeywords: EGG_WORDS, commonDishes: [], venueTags: [] },
  {
    key: "milk",
    aliases: ["milk", "dairy", "lactose"],
    dishKeywords: MILK_WORDS,
    commonDishes: [],
    venueTags: ["Dairy free"],
  },
  {
    key: "sesame",
    aliases: ["sesame"],
    dishKeywords: ["sesame"],
    commonDishes: ["hummus", "tahini"],
    venueTags: [],
  },
  {
    key: "soy",
    aliases: ["soy", "soya", "soybean"],
    dishKeywords: ["soy", "soya", "soybean", "tofu", "edamame", "miso", "tempeh"],
    commonDishes: [],
    venueTags: [],
  },
  {
    key: "wheat",
    aliases: ["wheat", "gluten", "celiac", "coeliac"],
    dishKeywords: WHEAT_WORDS,
    commonDishes: [],
    venueTags: ["Gluten free", "Gluten free options", "Gluten free friendly", "Celiac friendly"],
  },
];

export interface AllergenRule {
  dishKeywords: string[];
  commonDishes: { dish: string; allergen: string }[];
  venueTags: string[];
}

/** Venue tags that are a positive note for any allergy. */
export const GENERAL_ALLERGY_TAGS = ["Allergy friendly"] as const;

/**
 * Keywords and venue tags for a free-text allergy. Unknown allergies (e.g. "mustard") fall back
 * to the term itself as the only dish keyword.
 */
export function allergenRule(allergy: string): AllergenRule {
  const term = normalizeTerm(allergy).replace(/\s+allergy$/, "");
  const groups = ALLERGEN_GROUPS.filter((g) => g.aliases.some((a) => aliasCovers(term, a)));
  if (!groups.length) {
    return { dishKeywords: [term], commonDishes: [], venueTags: [...GENERAL_ALLERGY_TAGS] };
  }
  return {
    dishKeywords: unique(groups.flatMap((g) => g.dishKeywords)),
    commonDishes: groups.flatMap((g) => g.commonDishes.map((dish) => ({ dish, allergen: g.key }))),
    venueTags: unique([...GENERAL_ALLERGY_TAGS, ...groups.flatMap((g) => g.venueTags)]),
  };
}

/** An alias selects a group only when it is the whole term (allowing a plural), e.g. "peanuts". */
function aliasCovers(term: string, alias: string): boolean {
  return term === alias || term === `${alias}s` || term === `${alias}es`;
}

// --- Dietary restrictions ----------------------------------------------------------------------

const PORK_WORDS = [
  "pork", "bacon", "ham", "prosciutto", "pancetta", "chorizo", "pepperoni", "salami", "lard",
];
const MEAT_WORDS = [
  ...PORK_WORDS, "meat", "beef", "chicken", "lamb", "goat", "mutton", "veal", "turkey", "duck",
  "sausage", "pastrami", "brisket", "steak", "meatball", "bresaola", "short rib", "oxtail",
  "burger", "hot dog", "gyro",
];
export interface DietRule {
  key: string;
  aliases: readonly string[];
  /** Venue tags (dietary_option / offerings) that explicitly support the restriction. */
  venueTags: readonly string[];
  /** Words in a dish name that conflict with the restriction. */
  conflictKeywords: readonly string[];
  /**
   * True when the tag claims the whole venue complies (halal, kosher), so a conflicting dish
   * contradicts it. Otherwise the tag means "has options" and conflicting dishes are just skipped.
   */
  venueWide?: boolean;
}

export const DIET_RULES: readonly DietRule[] = [
  {
    key: "vegetarian",
    aliases: ["vegetarian", "veggie", "no meat"],
    venueTags: ["Vegetarian", "Vegetarian meals", "Vegan", "Vegan meals", "Plant based"],
    conflictKeywords: [...MEAT_WORDS, ...FISH_WORDS, ...SHELLFISH_WORDS],
  },
  {
    key: "vegan",
    aliases: ["vegan", "plant based", "plant-based"],
    venueTags: ["Vegan", "Vegan meals", "Plant based"],
    conflictKeywords: [...MEAT_WORDS, ...FISH_WORDS, ...SHELLFISH_WORDS, ...MILK_WORDS, ...EGG_WORDS],
  },
  {
    key: "pescatarian",
    aliases: ["pescatarian", "pescetarian"],
    venueTags: ["Pescatarian"],
    conflictKeywords: MEAT_WORDS,
  },
  {
    key: "halal",
    aliases: ["halal"],
    venueTags: ["Halal", "Halal food", "Halal options"],
    conflictKeywords: PORK_WORDS,
    venueWide: true,
  },
  {
    key: "kosher",
    aliases: ["kosher"],
    venueTags: ["Certified kosher food", "Kosher"],
    conflictKeywords: [...PORK_WORDS, ...SHELLFISH_WORDS],
    venueWide: true,
  },
  // No Qloo tag means "pork-free", so this can never be "matched".
  { key: "no pork", aliases: ["no pork", "pork free", "pork-free"], venueTags: [], conflictKeywords: PORK_WORDS },
  {
    key: "gluten free",
    aliases: ["gluten free", "gluten-free", "no gluten", "celiac", "coeliac"],
    venueTags: ["Gluten free", "Gluten free options", "Gluten free friendly", "Celiac friendly"],
    conflictKeywords: WHEAT_WORDS,
  },
  {
    key: "dairy free",
    aliases: ["dairy free", "dairy-free", "no dairy", "lactose free", "lactose-free"],
    venueTags: ["Dairy free"],
    conflictKeywords: MILK_WORDS,
  },
];

/**
 * Rule for a free-text restriction. Unknown "no X" / "X free" restrictions conflict with X;
 * anything else has no keywords and no supporting tags.
 */
export function dietRule(restriction: string): DietRule {
  const term = normalizeTerm(restriction);
  const known = DIET_RULES.find((r) => r.aliases.includes(term));
  if (known) return known;
  const banned = /^no (.+)$/.exec(term)?.[1] ?? /^(.+?)[ -]free$/.exec(term)?.[1];
  return { key: term, aliases: [term], venueTags: [], conflictKeywords: banned ? [banned] : [] };
}

// --- Texture -----------------------------------------------------------------------------------

/** Dish words that *suggest* softer food. Only ever "possibly soft — confirm". */
export const SOFT_DISH_KEYWORDS = [
  "soup", "stew", "porridge", "mashed", "mash", "puree", "purée", "pudding", "congee", "jook",
  "custard", "risotto", "polenta", "grits", "oatmeal", "dal", "dhal", "braised", "pho",
  "fufu", "pounded yam", "amala", "eba", "moi moi", "mac and cheese",
];

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
