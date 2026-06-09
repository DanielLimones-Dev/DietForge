import type { Food } from "@/types";

export function classifyCarbs(food: { name: string; category: string; fiber: number; carbs: number }): "fast" | "slow" | "mixed" | undefined {
  if (food.carbs < 2) return undefined;
  const n = food.name.toLowerCase();
  const c = food.category;

  const fastKeywords = ["pan blanco", "arroz blanco", "papa", "galleta", "cereal de caja", "hot cake", "miel", "azúcar", "jugo", "refresco", "horchata", "jamaica", "sandía", "plátano", "uva", "piña", "mango", "papaya", "arroz con leche", "flan", "chocolate con leche", "mermelada", "cajeta", "barra de proteína", "pan tostado", "tortilla de harina", "galletas marías", "galletas de avena", "chocolate", "crema de cacahuate"];
  const slowKeywords = ["integral", "avena", "frijol", "lenteja", "garbanzo", "brócoli", "espinaca", "zanahoria", "nopal", "chía", "legume", "pasta", "arroz integral", "quinoa", "batata", "boniato", "edamame", "soya"];

  if (c === "fruits" || c === "beverages" || c === "carbs") {
    if (food.fiber >= 2) return "mixed";
    return "fast";
  }
  if (c === "vegetables" || c === "legumes" || c === "seeds") return "slow";
  if (c === "grains" || c === "other") {
    for (const kw of slowKeywords) { if (n.includes(kw)) return "slow"; }
    for (const kw of fastKeywords) { if (n.includes(kw)) return "fast"; }
    if (food.fiber >= 3) return "slow";
    return "mixed";
  }
  return undefined;
}

const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || "DEMO_KEY";
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

const FS_CLIENT_ID = import.meta.env.VITE_FATSECRET_CONSUMER_KEY;
const FS_CLIENT_SECRET = import.meta.env.VITE_FATSECRET_CONSUMER_SECRET;
const FS_WORKER = import.meta.env.VITE_FATSECRET_WORKER || "";
const FS_BASE = "https://platform.fatsecret.com/rest";
const FS_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";

let fsToken: { access: string; expires: number } | null = null;

async function getFSToken(): Promise<string> {
  if (fsToken && Date.now() < fsToken.expires) return fsToken.access;
  const res = await fetch(FS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: FS_CLIENT_ID,
      client_secret: FS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`FatSecret auth failed: ${res.status}`);
  const data = await res.json();
  fsToken = { access: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
}

interface FatSecretResponse {
  foods?: {
    food?: FatSecretFood[];
  };
}

interface USDASearchResult {
  foods: Array<{
    fdcId: number;
    description: string;
    foodCategory?: string;
    foodNutrients: Array<{
      nutrientName: string;
      value: number;
      unitName: string;
    }>;
  }>;
}

interface OpenFoodFactsProduct {
  product: {
    product_name: string;
    nutriments?: {
      "energy-kcal_100g"?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
    };
  };
}

function mapCategory(usdaCategory?: string): Food["category"] {
  const map: Record<string, Food["category"]> = {
    "Meats": "protein",
    "Poultry": "protein",
    "Fish": "protein",
    "Legumes and Legume Products": "legumes",
    "Dairy and Egg Products": "dairy",
    "Cereal Grains and Pasta": "grains",
    "Vegetables": "vegetables",
    "Fruits": "fruits",
    "Nuts and Seeds": "nuts",
    "Fats and Oils": "fats",
  };
  if (!usdaCategory) return "other";
  for (const [k, v] of Object.entries(map)) {
    if (usdaCategory.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "other";
}

function parseFatSecretDesc(desc: string): { protein: number; carbs: number; fat: number; kcal: number } {
  const kcal = desc.match(/Calories:\s*([\d,]+)/i);
  const fat = desc.match(/Fat:\s*([\d,.]+)g/i);
  const carbs = desc.match(/Carbs:\s*([\d,.]+)g/i);
  const protein = desc.match(/Protein:\s*([\d,.]+)g/i);
  return {
    kcal: kcal ? parseFloat(kcal[1].replace(",", "")) : 0,
    fat: fat ? parseFloat(fat[1].replace(",", ".")) : 0,
    carbs: carbs ? parseFloat(carbs[1].replace(",", ".")) : 0,
    protein: protein ? parseFloat(protein[1].replace(",", ".")) : 0,
  };
}

export async function searchUSDA(query: string): Promise<Food[]> {
  try {
    const res = await fetch(
      `${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=10`,
    );
    if (!res.ok) return [];
    const data: USDASearchResult = await res.json();
    if (!data.foods) return [];

    return data.foods.map((f) => {
      const getNutrient = (name: string) =>
        f.foodNutrients.find((n) =>
          n.nutrientName.toLowerCase().includes(name.toLowerCase()),
        )?.value || 0;

      const protein = getNutrient("protein");
      const carbs = getNutrient("carbohydrate");
      const fat = getNutrient("total lipid");
      const fiber = getNutrient("fiber");
      const kcal = getNutrient("energy");

      const base = {
        id: 0,
        name: f.description,
        category: mapCategory(f.foodCategory),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        fiber: Math.round(fiber * 10) / 10,
        antioxidants: 0,
        kcal: Math.round(kcal),
        serving_size: 100,
        serving_unit: "g",
        source: "api" as const,
      };
      return { ...base, carb_type: classifyCarbs(base) };
    });
  } catch (e) {
    console.warn("USDA search failed:", e);
    return [];
  }
}

export async function searchFatSecret(query: string): Promise<Food[]> {
  try {
    let data: FatSecretResponse;
    const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
    const qs = new URLSearchParams({ q: query }).toString();

    if (FS_WORKER) {
      const res = await fetch(`${FS_WORKER}?${qs}`);
      if (!res.ok) return [];
      data = await res.json();
    } else if (!isTauri) {
      const res = await fetch(`/api/fatsecret/rest/server.api?${qs}`);
      if (!res.ok) return [];
      data = await res.json();
    } else {
      const token = await getFSToken();
      const body = new URLSearchParams({
        method: "foods.search.v5",
        search_expression: query,
        format: "json",
        max_results: "20",
      });
      const res = await fetch(`${FS_BASE}/server.api`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) {
        console.warn("FatSecret API error:", res.status, await res.text().catch(() => ""));
        return [];
      }
      data = await res.json();
    }

    const foods = data.foods?.food;
    if (!foods?.length) return [];

    return foods.map((f) => {
      const n = f.food_description ? parseFatSecretDesc(f.food_description) : { protein: 0, carbs: 0, fat: 0, kcal: 0 };
      const name = f.brand_name ? `${f.food_name} (${f.brand_name})` : f.food_name;
      const base = {
        id: 0,
        name,
        category: "other" as Food["category"],
        protein: Math.round(n.protein * 10) / 10,
        carbs: Math.round(n.carbs * 10) / 10,
        fat: Math.round(n.fat * 10) / 10,
        fiber: 0,
        antioxidants: 0,
        kcal: Math.round(n.kcal),
        serving_size: 100,
        serving_unit: "g",
        source: "api" as const,
      };
      return { ...base, carb_type: classifyCarbs(base) };
    });
  } catch (e) {
    console.warn("FatSecret API search failed:", e);
    return [];
  }
}

export async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=true&page_size=10`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.products) return [];

    return data.products
      .filter((p: { product_name?: string }) => p.product_name)
      .map((p: OpenFoodFactsProduct["product"]) => {
        const n = p.nutriments || {};
        const base = {
          id: 0,
          name: p.product_name || query,
          category: "other" as Food["category"],
          protein: n.proteins_100g || 0,
          carbs: n.carbohydrates_100g || 0,
          fat: n.fat_100g || 0,
          fiber: n.fiber_100g || 0,
          antioxidants: 0,
          kcal: n["energy-kcal_100g"] || 0,
          serving_size: 100,
          serving_unit: "g",
          source: "api" as const,
        };
        return { ...base, carb_type: classifyCarbs(base) };
      });
  } catch (e) {
    console.warn("OpenFoodFacts search failed:", e);
    return [];
  }
}
