import { Category, Product, ComboDeal } from "./types";

export const INITIAL_CATEGORIES: Category[] = [
  { id: "fruits", name: "Fruits", iconName: "Apple" },
  { id: "combos", name: "Combo Deals", iconName: "Gift" },
  { id: "vegetables", name: "Vegetables", iconName: "Leaf" },
  { id: "dairy", name: "Kitchen", iconName: "ChefHat" },
  { id: "snacks", name: "Snacks", iconName: "Cookie" },
  { id: "beverages", name: "Cold Drinks", iconName: "CupSoda" },
  { id: "bakery", name: "Bakery", iconName: "Croissant" },
  { id: "personal-care", name: "Personal Care", iconName: "Sparkles" },
  { id: "household", name: "Household Essentials", iconName: "Home" },
  { id: "frozen", name: "Frozen Food", iconName: "FlameKindling" }, // standing in for cold/ice
  { id: "baby", name: "Baby Care", iconName: "Baby" },
  { id: "pet", name: "Pet Care", iconName: "Dog" },
];

export const INITIAL_PRODUCTS: Product[] = [];

export const COMBO_DEALS: ComboDeal[] = [
  {
    id: "combo1",
    title: "Healthy High-Fiber Breakfast Combo",
    productIds: ["f1", "bk1", "b2"], // Bananas, Wheat Sourdough, Coconut Water
    originalPrice: 280, // 55 + 120 + 49 = 224
    sellingPrice: 199,
    image: "https://images.unsplash.com/photo-1496041675317-fa287df1c998?auto=format&fit=crop&q=80&w=400",
    badge: "Save ₹25 Extra",
  },
  {
    id: "combo2",
    title: "Movie Night Crisps & Cola Binge Pack",
    productIds: ["s1", "s2", "b1"], // Chips, Cookies, Cola
    originalPrice: 175, // 36 + 99 + 40 = 175
    sellingPrice: 149,
    image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=400",
    badge: "15% off Combo",
  }
];
