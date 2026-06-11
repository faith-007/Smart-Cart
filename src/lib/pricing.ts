export interface PricingBreakdown {
  subtotal: number;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  platformFee: number;
  handlingCharge: number;
  total: number;
  amountNeededForFreeDelivery: number;
  progressMessage: string;
}

/**
 * Calculates current pricing breakdown for a given subtotal based on SmartCart pricing rules:
 * - Subtotal below ₹100 (Order Value below ₹99, and also ₹99) -> Delivery Charge = ₹35
 * - Subtotal ₹100 to ₹149.99 -> Delivery Charge = ₹30
 * - Subtotal ₹150 and above -> Delivery Charge = ₹0 (Free Delivery)
 *
 * Permanent charges:
 * - Platform Fee = ₹3
 * - Handling Charge = ₹10
 */
export function calculatePricing(subtotal: number): PricingBreakdown {
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  
  if (roundedSubtotal === 0) {
    return {
      subtotal: 0,
      deliveryCharge: 0,
      isFreeDelivery: false,
      platformFee: 0,
      handlingCharge: 0,
      total: 0,
      amountNeededForFreeDelivery: 150,
      progressMessage: "Add ₹150 more for FREE DELIVERY",
    };
  }

  let deliveryCharge = 0;
  let isFreeDelivery = false;
  let amountNeededForFreeDelivery = 0;

  if (roundedSubtotal < 100) {
    deliveryCharge = 35;
    amountNeededForFreeDelivery = 150 - roundedSubtotal;
  } else if (roundedSubtotal < 150) {
    deliveryCharge = 30;
    amountNeededForFreeDelivery = 150 - roundedSubtotal;
  } else {
    deliveryCharge = 0;
    isFreeDelivery = true;
    amountNeededForFreeDelivery = 0;
  }

  const platformFee = 3;
  const handlingCharge = 10;
  const total = roundedSubtotal + deliveryCharge + platformFee + handlingCharge;

  const roundedAmountNeeded = Math.round(amountNeededForFreeDelivery * 100) / 100;

  return {
    subtotal: roundedSubtotal,
    deliveryCharge,
    isFreeDelivery,
    platformFee,
    handlingCharge,
    total: Math.round(total * 100) / 100,
    amountNeededForFreeDelivery: roundedAmountNeeded,
    progressMessage: isFreeDelivery 
      ? "🎉 You unlocked FREE DELIVERY!" 
      : `Add ₹${roundedAmountNeeded} more for FREE DELIVERY`,
  };
}
