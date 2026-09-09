import type { Food } from "@/types";
import { supabase } from "@/lib/supabase";
import {parseFatSecretDesc} from './nutrition-normalization';

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

async function searchProvider(provider: "usda" | "fatsecret", query: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para buscar alimentos.");
  return fetch(`/api/nutrition/${provider}?${new URLSearchParams({ q: query })}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
}

interface FatSecretResponse {
  foods?: {
    food?: FatSecretFood[] | FatSecretFood;
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

export async function searchUSDA(query: string): Promise<Food[]> {
  try {
    const res = await searchProvider("usda", query);
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
    const res = await searchProvider("fatsecret", query);
    if (!res.ok) return [];
    const data: FatSecretResponse = await res.json();

    const result = data.foods?.food;
    const foods = result ? (Array.isArray(result) ? result : [result]) : [];
    if (!foods?.length) return [];

    return foods.flatMap((f) => {
      const n = parseFatSecretDesc(f.food_description??'');
      if(!n)return [];
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
        serving_unit: n.serving_unit,
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
