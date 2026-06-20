import React from "react";
import { Gift, Plus, Minus, ShoppingBag } from "lucide-react";
import { ComboDeal, Product } from "../types";
import { motion } from "motion/react";

interface ComboCardProps {
  combo: ComboDeal;
  cartQty: number;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  allProducts: Product[]; // to lookup actual products & stock
  key?: string | number;
}

export default function ComboCard({
  combo,
  cartQty,
  onAddToCart,
  onRemoveFromCart,
  allProducts,
}: ComboCardProps) {
  // Find real product info for all items in the combo
  const includedProducts = combo.productIds
    ? allProducts.filter((p) => combo.productIds.includes(p.id))
    : combo.products || [];

  // Determine low-stock / availability constraint
  const isOutOfStock = includedProducts.length > 0 && includedProducts.some((p) => p.stock <= 0);
  const minStock = includedProducts.length > 0 ? Math.min(...includedProducts.map((p) => p.stock)) : 99;

  // Pricing calculations
  const originalPrice = combo.originalPrice;
  const comboPrice = combo.comboPrice ?? combo.sellingPrice;
  const savings = combo.savings ?? Math.max(0, originalPrice - comboPrice);

  // Helper to map ComboDeal to a pseudo-Product for standard Cart functions
  const handleAdd = () => {
    if (isOutOfStock) return;
    const pseudo: Product = {
      id: combo.id,
      name: combo.title || combo.name || "",
      brand: "🔥 Combo Deal",
      category: "Combo Deals",
      weight: "Bundle Offer",
      marketPrice: originalPrice,
      sellingPrice: comboPrice,
      discount: Math.round((savings / originalPrice) * 100),
      stock: minStock,
      image: combo.image,
      description: combo.description || `Includes: ${includedProducts.map((p) => p.name).join(", ")}`,
      isFeatured: false,
      isBestOffer: true,
      rating: 5,
      ratingCount: 1,
    };
    onAddToCart(pseudo);
  };

  const handleRemove = () => {
    const pseudo: Product = {
      id: combo.id,
      name: combo.title || combo.name || "",
      brand: "🔥 Combo Deal",
      category: "Combo Deals",
      weight: "Bundle Offer",
      marketPrice: originalPrice,
      sellingPrice: comboPrice,
      discount: Math.round((savings / originalPrice) * 100),
      stock: minStock,
      image: combo.image,
      description: combo.description || `Includes: ${includedProducts.map((p) => p.name).join(", ")}`,
      isFeatured: false,
      isBestOffer: true,
      rating: 5,
      ratingCount: 1,
    };
    onRemoveFromCart(pseudo);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="group relative flex flex-col h-full bg-white rounded-2xl border border-gray-100 hover:border-green-150 hover:shadow-lg hover:shadow-green-50/40 transition-all duration-300 overflow-hidden text-left"
    >
      {/* Badge offer overlays */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] bg-red-500 text-white font-black px-2 py-0.5 rounded-lg shadow-sm leading-none uppercase">
          🔥 COMBO OFFER
        </span>
        {savings > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-600 text-white font-black px-2 py-0.5 rounded-lg shadow-sm leading-none">
            💰 SAVE ₹{savings}
          </span>
        )}
      </div>

      {/* Combo Banner Image */}
      <div className="relative aspect-video w-full bg-gray-50 overflow-hidden shrink-0">
        <img
          src={combo.image || "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=400"}
          alt={combo.title || combo.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
            <span className="text-[11px] font-black tracking-widest text-gray-800 bg-white border border-gray-200 px-3 py-1.5 rounded-lg uppercase">
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      {/* Product content info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h4 className="text-sm font-black text-gray-900 group-hover:text-green-700 transition leading-tight line-clamp-2">
            {combo.title || combo.name}
          </h4>

          {combo.description && (
            <p className="text-[11px] font-semibold text-gray-400 line-clamp-2 leading-relaxed">
              {combo.description}
            </p>
          )}

          {/* List of included products */}
          <div className="pt-2 border-t border-gray-50">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
              Products Included ({includedProducts.length})
            </p>
            <div className="space-y-1">
              {includedProducts.length > 0 ? (
                includedProducts.map((p) => (
                  <div key={p.id} className="flex items-center space-x-1.5 text-[10px] text-gray-600">
                    <span className="h-1 w-1 rounded-full bg-green-500 shrink-0" />
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-gray-405 text-[9px] font-bold">({p.weight || "1 unit"})</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-gray-400 italic">No products mapped</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Panel and Prices line */}
        <div className="mt-4 pt-3.5 border-t border-gray-50 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">Combo Price</p>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-base font-black text-gray-955">₹{comboPrice}</span>
              {originalPrice > comboPrice && (
                <span className="text-[10px] text-gray-400 line-through font-bold">
                  ₹{originalPrice}
                </span>
              )}
            </div>
          </div>

          {/* Cart Buttons */}
          <div>
            {isOutOfStock ? (
              <button
                disabled
                className="rounded-xl bg-gray-100 text-gray-400 text-xs font-black p-2 px-3.5 cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : cartQty > 0 ? (
              <div className="flex items-center space-x-2 bg-green-500 text-white rounded-xl p-1 px-2.5 shadow-sm shadow-green-100">
                <button
                  onClick={handleRemove}
                  className="hover:scale-110 active:scale-95 text-xs font-black transition cursor-pointer p-0.5"
                  title="Remove combo"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-xs font-black text-center min-w-[12px]">{cartQty}</span>
                <button
                  onClick={handleAdd}
                  className="hover:scale-110 active:scale-95 text-xs font-black transition cursor-pointer p-0.5"
                  title="Add combo"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="rounded-xl border border-green-500 hover:bg-green-500 text-green-600 hover:text-white font-black text-xs p-2 px-4 transition active:scale-95 flex items-center space-x-1"
              >
                <Plus className="h-3 w-3 inline" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
