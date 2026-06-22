import { Product, Order } from "../types";

/**
 * Smart ranking formula:
 * popularityScore = (totalOrders * 5) + (totalSales * 4) + (totalViews * 2) + (totalAddToCart * 3)
 * Sort descending by popularityScore.
 * Tie-breaker: Newer products first (createdAt descending)
 */
export function sortProductsByPopularity(productsList: Product[]): Product[] {
  return [...productsList].sort((a, b) => {
    const aOrders = a.totalOrders || 0;
    const bOrders = b.totalOrders || 0;
    const aSales = a.totalSales || 0;
    const bSales = b.totalSales || 0;
    const aViews = a.totalViews || 0;
    const bViews = b.totalViews || 0;
    const aAddToCart = a.totalAddToCart || 0;
    const bAddToCart = b.totalAddToCart || 0;

    const scoreA = (aOrders * 5) + (aSales * 4) + (aViews * 2) + (aAddToCart * 3);
    const scoreB = (bOrders * 5) + (bSales * 4) + (bViews * 2) + (bAddToCart * 3);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Tie-breaker: Newly Added Products (createdAt descending)
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;

    return b.id.localeCompare(a.id);
  });
}

/**
 * Smart Shuffle Algorithm with Category Interleaving
 * Step 1: Group products by category
 * Step 2: Shuffle products inside each category using Fisher-Yates
 * Step 3: Interleave categories to ensure they are evenly distributed
 * Step 4: Return a single mixed product list with preserved item counts and no duplicates
 */
export function smartShuffleAndInterleave(productsList: Product[]): Product[] {
  if (productsList.length === 0) return [];

  // Group products by category
  const groups: { [category: string]: Product[] } = {};
  for (const product of productsList) {
    if (!product || !product.id) continue;
    const cat = product.category || "Other";
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(product);
  }

  // De-duplicate within each category just in case
  for (const cat in groups) {
    const seen = new Set<string>();
    groups[cat] = groups[cat].filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  // Shuffle products inside each category using Fisher-Yates shuffle
  for (const cat in groups) {
    const arr = groups[cat];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
  }

  const result: Product[] = [];
  const categoriesLeft = Object.keys(groups).map(cat => ({
    category: cat,
    items: groups[cat]
  })).filter(g => g.items.length > 0);

  // Initialize with largest categories first to distribute them best
  categoriesLeft.sort((a, b) => b.items.length - a.items.length);

  while (categoriesLeft.length > 0) {
    const lastItem = result[result.length - 1];
    const secondLastItem = result[result.length - 2];

    const lastCat = lastItem ? (lastItem.category || "Other") : null;
    const secondLastCat = secondLastItem ? (secondLastItem.category || "Other") : null;

    // Constraint: avoid more than 2 consecutive elements of the same category
    const mustAvoidCat = (lastCat && lastCat === secondLastCat) ? lastCat : null;

    let groupIndexToPick = -1;

    if (mustAvoidCat) {
      // Find the first category that is not the one we must avoid
      groupIndexToPick = categoriesLeft.findIndex(g => g.category !== mustAvoidCat);
    }

    if (groupIndexToPick === -1) {
      // Pick a category different from the last added category to maximize distribution
      if (lastCat) {
        groupIndexToPick = categoriesLeft.findIndex(g => g.category !== lastCat);
      }
      // Fallback: pick the first available group (which has the most items remaining)
      if (groupIndexToPick === -1) {
        groupIndexToPick = 0;
      }
    }

    const group = categoriesLeft[groupIndexToPick];
    const item = group.items.shift()!;
    result.push(item);

    // If no items are left in this category group, remove it
    if (group.items.length === 0) {
      categoriesLeft.splice(groupIndexToPick, 1);
    }

    // Keep categories sorted so the ones with the most remaining items are worked with first
    categoriesLeft.sort((a, b) => b.items.length - a.items.length);
  }

  return result;
}

/**
 * Smart Search Synonyms Mapping
 * Expanding matching keywords to categories, namkeens, similar brands, etc.
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  chips: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack", "biscuit", "cookie"],
  namkeen: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack"],
  kurkure: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack"],
  lays: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack"],
  haldiram: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack"],
  snacks: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack", "biscuit", "cookie"],
  snack: ["chips", "namkeen", "kurkure", "lays", "haldiram", "snacks", "snack", "biscuit", "cookie"],
  cookies: ["cookies", "biscuit", "biscuits", "bakery", "snacks"],
  biscuits: ["cookies", "biscuit", "biscuits", "bakery", "snacks"],
  biscuit: ["cookies", "biscuit", "biscuits", "bakery", "snacks"],
  
  milk: ["milk", "dairy", "butter", "paneer", "cheese", "curd", "egg", "eggs", "ghee", "cream"],
  dairy: ["milk", "dairy", "butter", "paneer", "cheese", "curd", "egg", "eggs", "ghee", "cream"],
  butter: ["milk", "dairy", "butter", "paneer", "cheese", "curd", "ghee"],
  paneer: ["milk", "dairy", "butter", "paneer", "cheese", "curd"],
  cheese: ["milk", "dairy", "butter", "paneer", "cheese", "curd"],
  curd: ["milk", "dairy", "butter", "paneer", "cheese", "curd"],
  
  pet: ["pet", "dog", "cat", "food", "treats", "accessories", "shampoo", "toy", "fish food"],
  dog: ["pet", "dog", "cat", "food", "treats", "accessories"],
  cat: ["pet", "dog", "cat", "food", "treats", "accessories"],
  treats: ["pet", "dog", "cat", "food", "treats", "accessories"],
  food: ["pet", "dog", "cat", "food", "treats"]
};

/**
 * Smart Search returning ranked products based on direct keywords + categories + fuzzy synonyms
 */
export function getSmartSearchMatches(productsList: Product[], query: string): Product[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  // Identify all synonym queries to broaden the matching net
  const synonyms = new Set<string>();
  synonyms.add(term);

  // Expand with any synonymous lookup term in our map
  Object.entries(SEARCH_SYNONYMS).forEach(([key, values]) => {
    if (term.includes(key) || key.includes(term)) {
      synonyms.add(key);
      values.forEach(v => synonyms.add(v));
    }
  });

  const matches = productsList.filter(p => {
    const nameLow = p.name.toLowerCase();
    const brandLow = p.brand.toLowerCase();
    const catLow = p.category.toLowerCase();
    const descLow = (p.description || "").toLowerCase();

    // Check query directly
    if (nameLow.includes(term) || brandLow.includes(term) || catLow.includes(term) || descLow.includes(term)) {
      return true;
    }

    // Check synonym terms
    for (const syn of synonyms) {
      if (nameLow.includes(syn) || brandLow.includes(syn) || catLow.includes(syn) || descLow.includes(syn)) {
        return true;
      }
    }

    return false;
  });

  // Always return rated/purchased/trending matches first
  return sortProductsByPopularity(matches);
}

/**
 * Related Product Recommendations ("🛍️ You May Also Like")
 * Based on query, category groupings, complementary snacks, dairy pairs, etc.
 */
export function getRelatedRecommendations(productsList: Product[], searchResults: Product[], query: string): Product[] {
  const term = query.trim().toLowerCase();
  const matchedCategories = new Set<string>();
  const searchResultIds = new Set<string>(searchResults.map(p => p.id));

  // Extract categories of products returned by search
  searchResults.forEach(p => matchedCategories.add(p.category));

  const complementaryCategories = new Set<string>();
  const complementaryKeywords = new Set<string>();

  // Implement the rules described in item 4
  if (
    term.includes("cold drink") || 
    term.includes("beverage") || 
    term.includes("cola") || 
    term.includes("pepsi") || 
    term.includes("juice") || 
    term.includes("drink") ||
    matchedCategories.has("beverages")
  ) {
    // Recommend chips, namkeen, biscuits, ice cream
    complementaryCategories.add("snacks");
    complementaryCategories.add("bakery");
    complementaryCategories.add("frozen");
    complementaryKeywords.add("chips");
    complementaryKeywords.add("namkeen");
    complementaryKeywords.add("biscuit");
    complementaryKeywords.add("biscuits");
    complementaryKeywords.add("ice cream");
    complementaryKeywords.add("lays");
    complementaryKeywords.add("kurkure");
  } else if (
    term.includes("chip") || 
    term.includes("lays") || 
    term.includes("namkeen") || 
    term.includes("snack") || 
    matchedCategories.has("snacks")
  ) {
    // complementary snacks want cold drinks/beverages
    complementaryCategories.add("beverages");
    complementaryKeywords.add("cold drink");
    complementaryKeywords.add("drink");
    complementaryKeywords.add("coke");
    complementaryKeywords.add("sprite");
    complementaryKeywords.add("cola");
    complementaryKeywords.add("juice");
  } else if (
    term.includes("milk") || 
    term.includes("dairy") || 
    term.includes("curd") || 
    term.includes("paneer") || 
    matchedCategories.has("dairy")
  ) {
    // recommended: bakery, or complementar egg items
    complementaryCategories.add("bakery");
    complementaryKeywords.add("bread");
    complementaryKeywords.add("sourdough");
    complementaryKeywords.add("toast");
    complementaryKeywords.add("bun");
  } else if (
    term.includes("pet") || 
    term.includes("dog") || 
    term.includes("cat") || 
    matchedCategories.has("pet")
  ) {
    // complementary pet care accessories
    complementaryKeywords.add("food");
    complementaryKeywords.add("treats");
    complementaryKeywords.add("accessories");
  } else {
    // Generic context: complementary categories
    matchedCategories.forEach(cat => {
      if (cat === "fruits") complementaryCategories.add("vegetables");
      if (cat === "vegetables") complementaryCategories.add("fruits");
      if (cat === "dairy") complementaryCategories.add("bakery");
      if (cat === "bakery") complementaryCategories.add("dairy");
    });
  }

  // Filter recommendations: must not be in search already
  const recommendations = productsList.filter(p => {
    if (searchResultIds.has(p.id)) return false;

    const nameLow = p.name.toLowerCase();
    const catLow = p.category.toLowerCase();
    const descLow = (p.description || "").toLowerCase();

    if (complementaryCategories.has(p.category) || matchedCategories.has(p.category)) {
      return true;
    }

    for (const kw of complementaryKeywords) {
      if (nameLow.includes(kw) || catLow.includes(kw) || descLow.includes(kw)) {
        return true;
      }
    }

    return false;
  });

  // Rank by standard popularity priorities and return top 5
  return sortProductsByPopularity(recommendations).slice(0, 5);
}

/**
 * Personalized Recommendations ("✨ Recommended For You")
 * Aggregates user's previous categories, browsing patterns, and queries
 */
export function getPersonalizedRecommendations(
  productsList: Product[],
  orders: Order[],
  userId: string | undefined,
  browsedCategories: Record<string, number> = {},
  searchedKeywords: string[] = []
): Product[] {
  if (!userId) {
    return [];
  }

  // Aggregate stats from client/firebase orders
  const categoryWeights: Record<string, number> = {};

  // 1. Order History scoring
  const userOrders = orders.filter(o => o.userId === userId);
  userOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        const cat = item.product?.category;
        if (cat) {
          categoryWeights[cat] = (categoryWeights[cat] || 0) + (item.quantity * 3);
        }
      });
    }
  });

  // 2. Browsing category stats scoring
  Object.entries(browsedCategories).forEach(([cat, count]) => {
    categoryWeights[cat] = (categoryWeights[cat] || 0) + (count * 1.5);
  });

  // 3. Searched keywords category alignment scoring
  searchedKeywords.forEach(keyword => {
    const term = keyword.toLowerCase();
    productsList.forEach(p => {
      if (p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)) {
        categoryWeights[p.category] = (categoryWeights[p.category] || 0) + 1;
      }
    });
  });

  // If there's literally NO preference data, return empty so UI handles "New User Experience"
  const hasHistory = Object.keys(categoryWeights).length > 0;
  if (!hasHistory) {
    return [];
  }

  // Filter products in target categories
  const recommended = productsList.filter(p => categoryWeights[p.category] > 0);

  // Group and sort by a combined score of weight alignment + smart popularity ranking order
  return recommended.sort((a, b) => {
    const aWeight = categoryWeights[a.category] || 0;
    const bWeight = categoryWeights[b.category] || 0;
    if (bWeight !== aWeight) return bWeight - aWeight;

    // Use popularity sorting as fallback
    const aOrders = a.totalOrders || 0;
    const bOrders = b.totalOrders || 0;
    if (bOrders !== aOrders) return bOrders - aOrders;

    const aRating = a.rating || 0;
    const bRating = b.rating || 0;
    return bRating - aRating;
  });
}
