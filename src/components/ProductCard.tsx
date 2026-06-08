import React from "react";
import { Heart, Plus, Minus, Star, TrendingDown, ShieldAlert } from "lucide-react";
import { Product } from "../types";

interface ProductCardProps {
  key?: string | number;
  product: Product;
  cartQty: number;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (p: Product) => void;
  onSelectProduct: (p: Product) => void;
}

export default function ProductCard({
  product,
  cartQty,
  onAddToCart,
  onRemoveFromCart,
  isWishlisted,
  onToggleWishlist,
  onSelectProduct,
}: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 15;

  return (
    <div 
      className="group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs transition-all duration-300 hover:shadow-xl hover:border-gray-200"
      id={`product-card-${product.id}`}
    >
      
      {/* Absolute Badges */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
        {product.discount > 0 && (
          <span className="inline-flex items-center space-x-0.5 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-black text-white shadow-xs">
            <TrendingDown className="h-3 w-3" />
            <span>{product.discount}% OFF</span>
          </span>
        )}
        
        {product.isBestOffer && (
          <span className="inline-flex items-center rounded-lg bg-yellow-400 px-2 py-1 text-[10px] font-black text-gray-900 shadow-xs uppercase">
            Promo Deal
          </span>
        )}
      </div>

      {/* Wishlist Heart Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleWishlist(product);
        }}
        className={`absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-50 bg-white/95 shadow-md backdrop-blur-xs transition hover:scale-110 active:scale-95 ${
          isWishlisted ? "text-red-500" : "text-gray-400 hover:text-gray-600"
        }`}
        id={`wish-btn-${product.id}`}
      >
        <Heart className={`h-4.5 w-4.5 ${isWishlisted ? "fill-red-500" : ""}`} />
      </button>

      {/* Product Image & Info Selection Trigger */}
      <div 
        onClick={() => onSelectProduct(product)}
        className="cursor-pointer flex flex-col items-center pt-3 align-middle"
      >
        
        <div className="relative overflow-hidden rounded-xl bg-gray-50 h-32 w-32 flex items-center justify-center">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-2 text-center">
              <ShieldAlert className="h-6 w-6 text-red-500 mb-1" />
              <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Rating and Reviews */}
        <div className="mt-3 flex items-center space-x-1.5 self-start">
          <div className="flex items-center bg-green-50 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold text-green-700">
            <Star className="h-2.5 w-2.5 fill-green-700 mr-0.5" />
            <span>{product.rating}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-semibold">({product.ratingCount})</span>
        </div>

        {/* Brand & Name */}
        <div className="mt-1.5 self-start text-left w-full">
          <p className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest">{product.brand}</p>
          <h3 className="text-xs sm:text-sm font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-green-600 transition min-h-[36px]">
            {product.name}
          </h3>
          <p className="text-[11px] text-gray-400 font-bold mt-1">{product.weight}</p>
        </div>

      </div>

      {/* Price & Action Button Footer */}
      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
        
        {/* Pricing Layout */}
        <div className="flex flex-col text-left">
          <div className="flex items-baseline space-x-1">
            <span className="text-sm sm:text-base font-black text-gray-900">₹{product.sellingPrice}</span>
            {product.discount > 0 && (
              <span className="text-[10px] sm:text-xs font-semibold text-gray-400 line-through">₹{product.marketPrice}</span>
            )}
          </div>
          
          {/* Low Stock Status Indicator */}
          {isLowStock && (
            <span className="text-[9px] font-black text-red-500 animate-pulse mt-0.5">
              Only {product.stock} left!
            </span>
          )}
          
          {!isOutOfStock && !isLowStock && (
            <span className="text-[9px] font-bold text-green-600 mt-0.5">
              In Stock
            </span>
          )}
        </div>

        {/* Add to Cart Actions */}
        <div>
          {isOutOfStock ? (
            <button
              disabled
              className="rounded-xl bg-gray-100 px-4 py-1.5 text-xs font-bold text-gray-400 cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : cartQty > 0 ? (
            <div className="flex items-center space-x-2 bg-green-500 text-white rounded-xl px-2 py-1 shadow-md shadow-green-100">
              <button 
                onClick={() => onRemoveFromCart(product)}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <Minus className="h-3 w-3 font-bold" />
              </button>
              <span className="text-xs font-black px-1 min-w-[14px] text-center">{cartQty}</span>
              <button 
                onClick={() => onAddToCart(product)}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <Plus className="h-3 w-3 font-bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(product)}
              className="rounded-xl border border-green-500 bg-white hover:bg-green-500 hover:text-white text-green-600 font-extrabold text-xs px-4 py-1.5 shadow-sm transition-all duration-200 active:scale-95"
            >
              ADD
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
