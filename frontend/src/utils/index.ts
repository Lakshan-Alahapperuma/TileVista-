import { CartItem } from '@tilevista/types';

export function calculateDiscountedPrice(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price;
  if (discountPercent >= 100) return 0;
  return Number((price * (1 - discountPercent / 100)).toFixed(2));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export interface BillingDetails {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function calculateBilling(
  items: CartItem[],
  taxRatePercent = 15,
  specialPromoDiscount = 0
): BillingDetails {
  const subtotal = items.reduce((sum, cartItem) => {
    // If backend provided lineTotal directly, use it
    if (cartItem.lineTotal !== undefined) {
      return sum + cartItem.lineTotal;
    }
    // Fallback for mock data or if lineTotal isn't set yet
    const price = cartItem.item?.price || 0;
    return sum + (price * cartItem.quantity);
  }, 0);

  const discount = Number(specialPromoDiscount.toFixed(2));
  const subtotalAfterPromo = Math.max(0, subtotal - discount);
  const tax = 0;
  const total = Number((subtotalAfterPromo + tax).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount,
    tax,
    total,
  };
}

export function validateRoomDimensions(
  width: number,
  length: number,
  height: number
): { isValid: boolean; error?: string } {
  if (width < 1.0 || width > 10.0) {
    return { isValid: false, error: 'Width must be between 1.0 and 10.0 meters.' };
  }
  if (length < 1.0 || length > 10.0) {
    return { isValid: false, error: 'Length must be between 1.0 and 10.0 meters.' };
  }
  if (height < 1.8 || height > 4.0) {
    return { isValid: false, error: 'Height must be between 1.8 and 4.0 meters.' };
  }
  return { isValid: true };
}

export function calculateTileRequirements(
  areaSqM: number,
  tileDimensions = '600x600mm',
  wasteMarginPercent = 10
): { tilesNeeded: number; boxesNeeded: number; areaWithWaste: number } {
  const areaWithWaste = areaSqM * (1 + wasteMarginPercent / 100);

  let widthMm = 600;
  let heightMm = 600;
  const match = tileDimensions.toLowerCase().match(/(\d+)x(\d+)/);
  if (match) {
    widthMm = parseInt(match[1], 10);
    heightMm = parseInt(match[2], 10);
  }

  const tileAreaSqM = (widthMm / 1000) * (heightMm / 1000);
  const tilesNeeded = Math.ceil(areaWithWaste / tileAreaSqM);

  const tilesPerBox = 4;
  const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox);

  return {
    tilesNeeded,
    boxesNeeded,
    areaWithWaste: Number(areaWithWaste.toFixed(2)),
  };
}
