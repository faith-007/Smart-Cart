import React from "react";
import * as Icons from "lucide-react";
import { Category } from "../types";

interface CategoriesProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

// Map strings to Lucide components securely
const IconHelper = ({ name, className }: { name: string; className: string }) => {
  // Fallback to ShoppingBag if icon name not found
  const IconComponent = (Icons as any)[name] || Icons.ShoppingBag;
  return <IconComponent className={className} />;
};

export default function Categories({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoriesProps) {
  return (
    <div className="py-4 bg-white border-y border-gray-100" id="categories-filter-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-800 tracking-tight">Shop by Category</h2>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Fresh ingredients in minutes</p>
          </div>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-xs font-bold text-orange-500 hover:text-orange-600 hover:underline transition"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Horizontal scrollable categories layout */}
        <div className="flex overflow-x-auto pb-2 scrollbar-none gap-3 sm:gap-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          
          {/* "All" button first */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`flex flex-col items-center shrink-0 w-20 p-2.5 rounded-2xl transition-all duration-200 border cursor-pointer ${
              selectedCategory === null
                ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-100 scale-105"
                : "bg-gray-50 border-gray-50 text-gray-600 hover:bg-gray-100/70 hover:border-gray-200"
            }`}
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl mb-1.5 transition ${
              selectedCategory === null ? "bg-white/25" : "bg-white shadow-xs"
            }`}>
              <Icons.Grid className={`h-5 w-5 ${selectedCategory === null ? "text-white" : "text-green-600"}`} />
            </div>
            <span className="text-[10px] font-black tracking-wide truncate w-full text-center">All Items</span>
          </button>

          {/* Map of other categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex flex-col items-center shrink-0 w-20 p-2.5 rounded-2xl transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-100 scale-105"
                    : "bg-gray-50 border-gray-50 text-gray-600 hover:bg-gray-100/70 hover:border-gray-200"
                }`}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl mb-1.5 transition ${
                  isSelected ? "bg-white/25" : "bg-white shadow-xs"
                }`}>
                  <IconHelper
                    name={cat.iconName}
                    className={`h-5 w-5 ${isSelected ? "text-white" : "text-green-600"}`}
                  />
                </div>
                <span className="text-[10px] font-black tracking-wide truncate w-full text-center">{cat.name}</span>
              </button>
            );
          })}
          
        </div>

      </div>
    </div>
  );
}
