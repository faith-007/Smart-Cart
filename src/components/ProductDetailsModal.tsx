import React, { useState } from "react";
import { X, Star, Heart, Plus, Minus, Share2, Check, ShoppingBag, ShieldCheck } from "lucide-react";
import { Product } from "../types";

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  cartQty: number;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (p: Product) => void;
  allProducts: Product[];
  onProductClick: (p: Product) => void;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  cartQty,
  onAddToCart,
  onRemoveFromCart,
  isWishlisted,
  onToggleWishlist,
  allProducts,
  onProductClick,
}: ProductDetailsModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !product) return null;

  const savings = product.marketPrice - product.sellingPrice;
  const isOutOfStock = product.stock <= 0;

  // Find related products in same category (excluding current product)
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleShare = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        id="product-details-modal"
      >
        
        {/* Close Button Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition active:scale-95"
          id="close-details-modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Product Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column 1: Image & Sharing Options */}
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-square max-w-[340px] rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center border border-gray-100">
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              {product.discount > 0 && (
                <span className="absolute top-3 left-3 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-black text-white">
                  {product.discount}% OFF
                </span>
              )}
            </div>

            {/* Quick Share / Wishlist Bar */}
            <div className="flex items-center space-x-3 mt-4 w-full justify-center">
              <button
                onClick={() => onToggleWishlist(product)}
                className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                  isWishlisted
                    ? "border-red-100 bg-red-50 text-red-500"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${isWishlisted ? "fill-red-500" : ""}`} />
                <span>{isWishlisted ? "In Wishlist" : "Save to Wishlist"}</span>
              </button>

              <button
                onClick={handleShare}
                className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                  copiedLink
                    ? "border-green-100 bg-green-50 text-green-600"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {copiedLink ? <Check className="h-4.5 w-4.5" /> : <Share2 className="h-4.5 w-4.5" />}
                <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
              </button>
            </div>
          </div>

          {/* Column 2: Information Content */}
          <div className="flex flex-col justify-between text-left">
            <div>
              
              {/* Category & Status */}
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {product.brand}
                </span>
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {product.category}
                </span>
              </div>

              {/* Title */}
              <h1 className="mt-2 text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                {product.name}
              </h1>

              {/* Ratings */}
              <div className="mt-2 flex items-center space-x-2">
                <div className="flex items-center bg-green-500 text-white p-1 px-2 rounded-lg text-xs font-black">
                  <Star className="h-3 w-3 fill-white mr-1" />
                  <span>{product.rating}</span>
                </div>
                <span className="text-xs text-gray-400 font-semibold">{product.ratingCount} Verified Reviews</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-bold text-green-600">15 min delivery ready</span>
              </div>

              {/* Description */}
              <p className="mt-4 text-xs sm:text-sm text-gray-600 font-medium leading-relaxed">
                {product.description}
              </p>

              {/* Ingredients Details */}
              {product.ingredients && (
                <div className="mt-4 bg-gray-50/50 rounded-xl p-3 border border-gray-150">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ingredients</h4>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-normal">{product.ingredients}</p>
                </div>
              )}

              {/* Nutritional breakdown */}
              {product.nutrition && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Nutrition Facts (Per serving)</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Calories</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.calories}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Protein</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.protein}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Carbohydrates</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.carbs}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-405 uppercase">Fats</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.fat}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Price section & Dual action add */}
            <div className="mt-6 pt-5 border-t border-gray-150">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                
                {/* Pricing Box */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Pricing & Savings</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-gray-900">₹{product.sellingPrice}</span>
                    {product.discount > 0 && (
                      <span className="text-sm font-semibold text-gray-400 line-through">MRP ₹{product.marketPrice}</span>
                    )}
                  </div>
                  {savings > 0 && (
                    <p className="text-xs font-black text-green-600 mt-1">
                      You Save ₹{savings} ({product.discount}% lower than MRP!)
                    </p>
                  )}
                </div>

                {/* Add action */}
                <div className="w-full sm:w-auto">
                  {isOutOfStock ? (
                    <div className="rounded-xl bg-gray-150 p-2 text-center font-bold text-gray-400 cursor-not-allowed">
                      Product Out of Stock
                    </div>
                  ) : cartQty > 0 ? (
                    <div className="flex items-center justify-between border border-transparent bg-green-500 text-white rounded-xl px-4 py-2 px-3 shadow-lg shadow-green-100">
                      <span className="text-xs font-bold mr-3">Added to Cart</span>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => onRemoveFromCart(product)}
                          className="p-1 hover:bg-white/10 rounded-lg transition"
                        >
                          <Minus className="h-3.5 w-3.5 font-bold" />
                        </button>
                        <span className="text-sm font-black w-4 text-center">{cartQty}</span>
                        <button 
                          onClick={() => onAddToCart(product)}
                          className="p-1 hover:bg-white/10 rounded-lg transition"
                        >
                          <Plus className="h-3.5 w-3.5 font-bold" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      className="w-full sm:w-auto flex items-center justify-center space-x-2 rounded-xl bg-green-500 hover:bg-green-600 px-6 py-3 text-white font-black text-xs shadow-md shadow-green-100 transition active:scale-95"
                    >
                      <ShoppingBag className="h-4.5 w-4.5" />
                      <span>ADD ITEMS TO CART</span>
                    </button>
                  )}
                </div>

              </div>

              {/* Delivery Promise Badge */}
              <div className="flex items-center space-x-2 mt-4 bg-orange-50 p-2.5 rounded-xl border border-orange-100">
                <ShieldCheck className="h-4 w-4 text-orange-500 shrink-0" />
                <p className="text-[10px] text-orange-850 font-bold leading-none">
                  SmartCart Guarantee: Fresh groceries delivered to your door in approximately 15 minutes!
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Related Products list */}
        {related.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-left">
            <h3 className="text-base font-black text-gray-800 tracking-tight">Customers Also Bought</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Fresh alternatives from {product.category}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p) => {
                const subSavings = p.marketPrice - p.sellingPrice;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onProductClick(p);
                    }}
                    className="cursor-pointer group flex flex-col p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition"
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center relative">
                      <img src={p.image} alt={p.name} className="h-16 w-16 object-cover" />
                      {p.discount > 0 && (
                        <span className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] font-black p-0.5 rounded">
                          -{p.discount}%
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1.5 text-xs font-bold text-gray-800 truncate leading-tight group-hover:text-green-600">
                      {p.name}
                    </h4>
                    <div className="flex items-baseline space-x-1 mt-0.5">
                      <span className="text-xs font-black text-gray-900">₹{p.sellingPrice}</span>
                      {p.discount > 0 && (
                        <span className="text-[8px] text-gray-400 line-through">₹{p.marketPrice}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
