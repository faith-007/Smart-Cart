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
    <div className="py-2.5 md:py-4 bg-white border-y border-gray-100" id="categories-filter-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center justify-between mb-2.5 md:mb-4">
          <div>
            <h2 className="text-sm md:text-lg font-black text-gray-800 tracking-tight">Shop by Category</h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-semibold uppercase tracking-wider">Fresh in 15 minutes</p>
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
        <div className="flex overflow-x-auto pb-1.5 scrollbar-none gap-2 md:gap-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          
          {/* "All" button first */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`flex flex-col items-center shrink-0 w-16 md:w-20 p-0.5 md:p-2.5 rounded-full md:rounded-2xl border-none md:border cursor-pointer transition-all duration-200 ${
              selectedCategory === null
                ? "text-green-600 font-extrabold"
                : "text-gray-500 font-medium hover:text-gray-900"
            }`}
          >
            <div className={`flex h-12 w-12 md:h-11 md:w-11 items-center justify-center rounded-full md:rounded-xl mb-1 transition ${
              selectedCategory === null
                ? "bg-green-500 text-white shadow-md shadow-green-100"
                : "bg-gray-50 hover:bg-gray-100 text-green-600 shadow-xs"
            }`}>
              <Icons.Grid className="h-5 w-5" />
            </div>
            <span className="text-[10px] md:text-[11px] font-bold tracking-wide mt-0.5 md:mt-0 truncate w-full text-center">All</span>
          </button>

          {/* Map of other categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex flex-col items-center shrink-0 w-16 md:w-20 p-0.5 md:p-2.5 rounded-full md:rounded-2xl border-none md:border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "text-green-600 font-extrabold"
                    : "text-gray-500 font-medium hover:text-gray-900"
                }`}
              >
                <div className={`flex h-12 w-12 md:h-11 md:w-11 items-center justify-center rounded-full md:rounded-xl mb-1 transition ${
                  isSelected
                    ? "bg-green-500 text-white shadow-md shadow-green-100"
                    : "bg-gray-50 hover:bg-gray-100 text-green-600 shadow-xs"
                }`}>
                  <IconHelper
                    name={cat.iconName}
                    className="h-5 w-5"
                  />
                </div>
                <span className="text-[10px] md:text-[11px] font-bold tracking-wide mt-0.5 md:mt-0 truncate w-full text-center">{cat.name}</span>
              </button>
            );
          })}
          
        </div>

      </div>
    </div>
  );
}
