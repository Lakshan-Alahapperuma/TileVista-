'use client';

import React, { useState } from 'react';
import { Trash2, Plus, Minus, CreditCard, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { calculateBilling, formatCurrency } from '../../utils';
import { useCart } from './hooks/useCart';
import Link from 'next/link';
import { useAuth } from '../auth/AuthContext';
import { useRouter } from 'next/navigation';

const STATIC_BASE = 'http://localhost:4000';

export const CartFeature: React.FC = () => {
  const { items, loading, error, updateQuantity, removeItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/cart');
    } else {
      router.push('/checkout');
    }
  };

  const { subtotal, discount, tax, total } = calculateBilling(items);

  if (loading) {
    return (
      <div className="p-8 bg-[#F9F9F7] text-[#1A1A1A] min-h-screen font-sans flex items-center justify-center">
        <p className="text-gray-500">Loading your cart...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[calc(100vh-104px)] bg-brandLight flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md p-8 border border-gray-200 bg-white shadow-sm text-center">

          {/* Header brand details */}
          <div className="text-center mb-6 flex flex-col items-center">
            {/* <span className="inline-flex items-center gap-1 text-[8.5px] font-bold tracking-widest px-3 py-1.5 bg-[#D4C5B9]/15 border border-[#D4C5B9]/30 text-[#1A1A1A] uppercase mb-3 leading-none">
              Shopping Basket
            </span> */}
            <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-wide mt-1">
              Your Cart Is Empty
            </h2>
            <p className="text-xs text-gray-500 font-light mt-3 leading-relaxed">
              Browse our premium tile collections and bathroom fixtures to visualize your perfect space.
            </p>
          </div>

          <div className="py-6 flex justify-center text-gray-300">
            <ShoppingCart size={48} strokeWidth={1.5} className="text-[#D4C5B9]" />
          </div>

          <Link href="/products/tiles" className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 mt-6 flex items-center justify-center gap-2">
            <span>Browse Products</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-12">
      {/* Page Header */}
      <div className="border-b border-gray-100 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase block mb-2">
            Your Cart
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1A1A1A]">
            Your Selected Products
          </h1>
          <p className="text-sm text-gray-500 font-light mt-1.5 max-w-xl leading-relaxed">
            Review your selections before completing checkout.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Items column */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((cartItem) => {
            const item = cartItem.item;
            const isAvailable = cartItem.isAvailable;

            return (
              <div
                key={cartItem.osposItemId}
                className={`bg-white border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center border border-gray-100">
                    {item.imageUrl ? (
                      <img src={`${STATIC_BASE}${item.imageUrl}`} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-gray-300" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase font-mono">{item.category || 'Unknown'}</span>
                      <span className="text-[9px] text-gray-400 font-mono">| {item.sku || 'N/A'}</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wide mt-1">
                      {item.name}
                    </h3>
                    {!isAvailable && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">Item is no longer available.</p>
                    )}

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-xs font-bold text-gray-700">
                        {formatCurrency(item.price)} each
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100">
                  {isAvailable && (
                    <div className="flex items-center bg-[#F9F9F7] border border-gray-200 p-1">
                      <button
                        onClick={() => updateQuantity(cartItem.osposItemId, cartItem.quantity - 1)}
                        className="p-1 hover:bg-gray-200 text-gray-500 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-12 text-center text-xs font-semibold text-[#1A1A1A] font-mono">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(cartItem.osposItemId, cartItem.quantity + 1)}
                        className="p-1.5 hover:bg-gray-200 text-gray-500 transition-colors"
                        aria-label="Increase quantity"
                        disabled={cartItem.quantity >= item.quantity}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                  <div className="text-right w-28 sm:w-36 shrink-0">
                    <span className="text-sm font-semibold text-[#1A1A1A] block whitespace-nowrap">
                      {formatCurrency(cartItem.lineTotal)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(cartItem.osposItemId)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-2"
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Link href="/products/tiles" className="text-xs font-semibold text-gray-500 hover:text-black transition-colors uppercase tracking-widest flex items-center gap-2">
              ← Continue Shopping
            </Link>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 font-medium"
            >
              <Trash2 size={12} /> Empty Cart
            </button>
          </div>
        </div>

        {/* Order Summary column */}
        <div className="lg:col-span-4">
          <div className="bg-[#F3EFE9] text-[#1A1A1A] p-8 sticky top-8 shadow-sm border border-[#D4C5B9]/40">
            <h2 className="text-xs font-bold tracking-widest text-[#8C7A6B] uppercase mb-6 border-b border-[#D4C5B9]/40 pb-4">
              Order Summary
            </h2>

            <div className="space-y-4 text-sm font-light">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#8C7A6B]">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatCurrency(discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-end border-t border-[#D4C5B9]/60 pt-4 mt-4 text-[#1A1A1A]">
                <span className="text-xs font-bold tracking-widest uppercase">Total</span>
                <span className="text-2xl font-bold tracking-tight">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => setShowPolicyModal(true)}
                className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] text-white hover:text-[#1A1A1A] py-4 text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                disabled={items.length === 0}
              >
                <span>Place Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPolicyModal(false)}>
          <div className="bg-white p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-4 border-b border-gray-100 pb-3">Showroom Pickup Policy</h3>
            <div className="text-sm text-gray-600 space-y-4 mb-8">
              <p className="leading-relaxed">No online payment is required. You can complete your order and reserve your items here.</p>
              <div className="bg-red-50 p-4 border-l-4 border-red-500 rounded-r-md">
                <p className="font-medium text-red-700">Note: Reserved items must be collected from our showroom within 5 days, or the reservation will automatically expire.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowPolicyModal(false)}
                className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPolicyModal(false);
                  handlePlaceOrder();
                }}
                className="px-6 py-2.5 text-xs font-bold tracking-widest uppercase text-white bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] transition-colors"
              >
                Continue to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-white p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Empty Cart</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to remove all items from your cart?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearCart();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Empty Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CartFeature;
