import React, { useState } from "react";
import { X, Plus, Minus, Trash2, Heart, Gift, ShoppingBag, ArrowRight, Percent, Info } from "lucide-react";
import { CartItem, Product } from "../types";
import { calculatePricing } from "../lib/pricing";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (p: Product, qty: number) => void;
  onRemoveItem: (p: Product) => void;
  onSaveForLater: (p: Product) => void;
  onProceedToCheckout: () => void;
  appliedPromo?: any;
  onApplyPromo?: any;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onSaveForLater,
  onProceedToCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  // Pricing calculations
  const {
    subtotal,
    deliveryCharge,
    isFreeDelivery,
    platformFee,
    handlingCharge,
    total: grandTotal,
    progressMessage,
  } = calculatePricing(
    cartItems.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0)
  );

  const discount = 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      
      {/* Drawer Overlay backdrop Close trigger */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Slide Drawer container */}
      <div 
        className="relative flex flex-col h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-250 z-10"
        id="cart-drawer-container"
      >
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-black text-gray-950">My basket ({cartItems.length} items)</h2>
          </div>
          <button 
            onClick={onClose} 
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Deliver Target Promise */}
        <div className={`${isFreeDelivery ? "bg-green-50/70 border-green-150" : "bg-orange-50/70 border-orange-100"} px-4 py-2.5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2`}>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-orange-500 text-white font-black px-1.5 py-0.5 rounded leading-none shrink-0">⚡ 15 MINS</span>
            <p className={`text-[11px] font-bold ${isFreeDelivery ? "text-green-800" : "text-orange-950"}`}>
              {progressMessage}
            </p>
          </div>
          {isFreeDelivery && (
            <span className="inline-flex items-center rounded-full bg-green-550/10 px-2.5 py-0.5 text-[9px] font-black text-green-750 uppercase tracking-wider">
              FREE DELIVERY UNLOCKED
            </span>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-sm font-black text-gray-800">Your basket is empty</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                Browse our categories and add fresh groceries to get them in 15 minutes!
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-xs px-5 py-2.5 transition active:scale-95"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cartItems.map((item) => (
                <div key={item.product.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 text-left">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-14 w-14 rounded-lg object-cover bg-gray-50 border border-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{item.product.brand} • {item.product.weight}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs font-black text-gray-900">₹{item.product.sellingPrice}</span>
                      {item.product.discount > 0 && (
                        <span className="text-[9px] text-gray-400 line-through">₹{item.product.marketPrice}</span>
                      )}
                    </div>

                    {/* Quick Move and Save For Later Actions */}
                    <div className="flex items-center space-x-3 mt-1.5 pt-1.5 border-t border-gray-50/50">
                      <button
                        onClick={() => onSaveForLater(item.product)}
                        className="flex items-center space-x-1 text-[10px] text-gray-400 hover:text-red-500 font-bold transition"
                        title="Save for Later"
                      >
                        <Heart className="h-3 w-3" />
                        <span>Save For Later</span>
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.product)}
                        className="flex items-center space-x-1 text-[10px] text-gray-400 hover:text-gray-600 font-bold transition"
                        title="Remove Item"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex flex-col items-end justify-between shrink-0">
                    <div className="flex items-center space-x-2 bg-green-500 text-white rounded-lg p-1 px-2.5">
                      <button 
                        onClick={() => onUpdateQty(item.product, item.quantity - 1)}
                        className="hover:scale-110 active:scale-95 text-xs font-black transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-black text-center min-w-[12px]">{item.quantity}</span>
                      <button 
                        onClick={() => onUpdateQty(item.product, item.quantity + 1)}
                        className="hover:scale-110 active:scale-95 text-xs font-black transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs font-extrabold text-gray-800">
                      ₹{item.product.sellingPrice * item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bill Summary & Pricing Calculations footer */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/70 p-4 space-y-3.5">
            
            {/* Bill Summary List */}
            <div className="space-y-1.5 border-t border-gray-150 pt-3 text-xs font-medium text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-extrabold text-gray-900">₹{subtotal}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span>Delivery Charge</span>
                  {isFreeDelivery && (
                    <span id="free-delivery-badge-cart" className="inline-flex items-center rounded-xs bg-green-550/10 px-1 py-0.5 text-[8px] font-black text-green-750 uppercase tracking-widest leading-none">
                      FREE DELIVERY
                    </span>
                  )}
                </span>
                <span className={`font-extrabold ${isFreeDelivery ? "text-green-600" : "text-gray-900"}`}>
                  {isFreeDelivery ? "FREE" : `₹${deliveryCharge}`}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center">
                  <span>Platform Fee</span>
                  <Info className="h-3 w-3 text-gray-400 ml-1" title="Platform support charge" />
                </span>
                <span className="font-extrabold text-gray-900">₹{platformFee}</span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center">
                  <span>Handling Charge</span>
                  <Info className="h-3 w-3 text-gray-400 ml-1" title="Safety & packing charges" />
                </span>
                <span className="font-extrabold text-gray-900">₹{handlingCharge}</span>
              </div>

              <div className="flex justify-between border-t border-gray-205 pt-2 text-sm font-black text-gray-955">
                <span>Total</span>
                <span>₹{grandTotal}</span>
              </div>
            </div>

            {/* Checkout CTA */}
            <button
              onClick={onProceedToCheckout}
              className="w-full flex items-center justify-between rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-sm p-4 shadow-md shadow-green-100 transition active:scale-95"
            >
              <div>
                <p className="text-[10px] text-green-100 font-bold uppercase tracking-wider text-left leading-none">PROCEED TO PAY</p>
                <p className="text-base font-black">₹{grandTotal}</p>
              </div>
              <div className="flex items-center space-x-1 font-black">
                <span>Select Address & Pay</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </div>
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
