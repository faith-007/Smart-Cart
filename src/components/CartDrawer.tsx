import React, { useState } from "react";
import { X, Plus, Minus, Trash2, Heart, Gift, ShoppingBag, ArrowRight, Percent, Info } from "lucide-react";
import { CartItem, Product, PromoCode } from "../types";
import { PROMO_CODES } from "../data";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (p: Product, qty: number) => void;
  onRemoveItem: (p: Product) => void;
  onSaveForLater: (p: Product) => void;
  onProceedToCheckout: () => void;
  appliedPromo: PromoCode | null;
  onApplyPromo: (promo: PromoCode | null) => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onSaveForLater,
  onProceedToCheckout,
  appliedPromo,
  onApplyPromo,
}: CartDrawerProps) {
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");

  if (!isOpen) return null;

  // Pricing calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  
  // Rule: Free delivery for orders above ₹200, otherwise ₹25
  const deliveryCharge = subtotal > 200 || subtotal === 0 ? 0 : 25;
  const platformFee = subtotal > 0 ? 2 : 0;

  let discount = 0;
  if (appliedPromo) {
    if (subtotal >= appliedPromo.minimumOrder) {
      discount = appliedPromo.discountValue;
    } else {
      // Auto-remove promo if cart value drops below criteria
      setTimeout(() => onApplyPromo(null), 50);
    }
  }

  const grandTotal = Math.max(0, subtotal - discount + deliveryCharge + platformFee);

  const handleApplyCouponCode = (code: string) => {
    const promo = PROMO_CODES.find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
    if (!promo) {
      setCouponError("Invalid Coupon Code! Try SMART20 or FRESH50.");
      return;
    }
    if (subtotal < promo.minimumOrder) {
      setCouponError(`Add items worth ₹${promo.minimumOrder - subtotal} more to apply this coupon.`);
      return;
    }
    setCouponError("");
    onApplyPromo(promo);
  };

  const handleRemoveCoupon = () => {
    onApplyPromo(null);
    setCouponInput("");
    setCouponError("");
  };

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
        <div className="bg-orange-50 px-4 py-2.5 flex items-center space-x-2 border-b border-orange-100">
          <span className="text-[10px] bg-orange-500 text-white font-black px-1.5 py-0.5 rounded">⚡ 15 MINS</span>
          <p className="text-[11px] font-bold text-orange-950">
            {subtotal > 200 ? "Congrats! Free delivery is unlocked for this order." : `Add items worth ₹${200 - subtotal} more for Free Delivery!`}
          </p>
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

        {/* Promo Codes & Pricing Calculations footer */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/70 p-4 space-y-3.5">
            
            {/* Promo Code Input section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Apply Promo Coupons</span>
                {appliedPromo && (
                  <button onClick={handleRemoveCoupon} className="text-[10px] text-red-500 font-bold hover:underline">
                    Remove
                  </button>
                )}
              </div>

              {appliedPromo ? (
                <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50/20 px-3 py-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Gift className="h-4.5 w-4.5 text-green-600 animate-bounce" />
                    <div>
                      <p className="font-extrabold text-green-950 tracking-wider">Coupon applied: {appliedPromo.code}</p>
                      <p className="text-[10px] text-green-600 font-semibold">{appliedPromo.description}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-green-700">-₹{appliedPromo.discountValue}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black uppercase text-gray-800 placeholder-gray-400 outline-hidden focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      placeholder="Enter code (e.g. SMART20, FRESH50)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                    />
                    <button
                      onClick={() => handleApplyCouponCode(couponInput)}
                      className="rounded-xl bg-gray-900 text-white font-black text-xs px-4 py-2 hover:bg-gray-800 transition"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-[10px] font-bold text-red-500 px-1">{couponError}</p>}
                </div>
              )}

              {/* Show available codes inline */}
              {!appliedPromo && (
                <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {PROMO_CODES.map((promo) => {
                    const isEligible = subtotal >= promo.minimumOrder;
                    return (
                      <button
                        key={promo.code}
                        onClick={() => {
                          setCouponInput(promo.code);
                          handleApplyCouponCode(promo.code);
                        }}
                        className={`flex flex-col items-start p-1.5 px-2.5 rounded-lg border text-left shrink-0 max-w-[170px] ${
                          isEligible 
                            ? "bg-white border-green-200 text-green-700 hover:bg-green-50/20" 
                            : "bg-white/50 border-gray-150 text-gray-400"
                        }`}
                      >
                        <span className="text-[10px] font-black tracking-wider uppercase">{promo.code}</span>
                        <span className="text-[8px] font-semibold text-gray-400 uppercase mt-0.5">Min Cart: ₹{promo.minimumOrder}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Bill Summary List */}
            <div className="space-y-1.5 border-t border-gray-150 pt-3 text-xs font-medium text-gray-600">
              <div className="flex justify-between">
                <span>Basket Subtotal</span>
                <span className="font-extrabold text-gray-900">₹{subtotal}</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center">
                    <Percent className="h-3 w-3 mr-1" />
                    <span>Coupon Discount</span>
                  </span>
                  <span className="font-black">-₹{discount}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="flex items-center">
                  <span>Delivery Charge</span>
                  {deliveryCharge === 0 && (
                    <span className="ml-1 px-1 bg-green-100 text-green-700 text-[8px] font-extrabold uppercase rounded-xs">Free</span>
                  )}
                </span>
                <span className="font-extrabold text-gray-900">
                  {deliveryCharge > 0 ? `₹${deliveryCharge}` : "₹0"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center">
                  <span>Small Order Platform Fee</span>
                  <Info className="h-3 w-3 text-gray-400 ml-1" title="Platform investment fee" />
                </span>
                <span className="font-extrabold text-gray-900">₹{platformFee}</span>
              </div>

              <div className="flex justify-between border-t border-gray-205 pt-2 text-sm font-black text-gray-955">
                <span>Grand Total</span>
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
