'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  ArrowLeft,
  Printer,
  Download,
  FileText,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../../features/cart/hooks/useCart';
import { useAuth } from '../../../features/auth/AuthContext';
import { formatCurrency } from '../../../utils';
import { downloadQuotationPDF, PDFOrderData } from '../../../utils/pdfGenerator';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<any | null>(null);

  // Authentication check & profile pre-fill
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/checkout');
      return;
    }
    if (user) {
      if (user.firstName || user.lastName) {
        setName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
      }
      if (user.email) {
        setEmail(user.email);
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setErrorMessage('Please fill in your full name and phone number.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty. Please add items before checking out.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      if (!savedToken) {
        throw new Error('Authentication session expired. Please log in again.');
      }

      const checkoutItems = items.map((cartItem) => ({
        osposItemId: cartItem.osposItemId,
        quantity: cartItem.quantity,
      }));

      const response = await fetch(`${API_BASE}/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          items: checkoutItems,
          shippingAddress: `${name} | ${phone} | ${email || 'No email'}`,
          paymentMethod: 'showroom_reference',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Order creation failed (${response.status})`);
      }

      const createdOrder = await response.json();

      // Order created successfully -> NOW clear cart!
      await clearCart();
      setOrderResult(createdOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while placing your order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!orderResult) return;
    const pdfData: PDFOrderData = {
      orderReference: orderResult.order_reference,
      customerName: name || (orderResult.users ? `${orderResult.users.first_name} ${orderResult.users.last_name}` : 'Customer'),
      phone: phone || orderResult.users?.phone || 'N/A',
      email: email || orderResult.users?.email || undefined,
      createdAt: orderResult.created_at || new Date().toISOString(),
      status: orderResult.status,
      approvalType: orderResult.approval_type,
      totalAmount: Number(orderResult.total_amount),
      items: (orderResult.order_items || []).map((item: any) => ({
        name: item.product_name_snapshot,
        sku: item.sku || `ITEM-${item.ospos_item_id}`,
        osposItemId: item.ospos_item_id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      })),
    };

    downloadQuotationPDF(pdfData);
  };

  if (authLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center font-sans text-gray-400 gap-3">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
        <span className="text-xs uppercase font-light tracking-wider">Verifying authentication session...</span>
      </div>
    );
  }

  // SUCCESS PAGE — Showroom Reference Confirmation & Order Receipt
  if (orderResult) {
    const isApproved = orderResult.status === 'approved';
    const isPending = orderResult.status === 'pending';

    return (
      <div className="py-12 px-6 flex justify-center font-sans">
        <div className="w-full max-w-2xl p-8 border border-gray-200 bg-white shadow-sm space-y-6">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
              isApproved
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              {isApproved ? <ClipboardCheck size={28} /> : <Clock size={28} />}
            </div>

            <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-wide">
              {isApproved ? 'Order Confirmed & Stock Reserved' : 'Order Submitted for Approval'}
            </h2>
            <p className="text-gray-500 text-xs mt-1.5 max-w-md mx-auto font-light leading-relaxed">
              {isApproved
                ? 'Your order has been verified and active stock reservations have been logged in our Matara POS database.'
                : 'Your order has been logged and is under stock threshold review by our Matara showroom administrators.'}
            </p>
          </div>

          {/* Reference Box */}
          <div className="p-6 bg-[#F9F9F7] border border-gray-200 text-center">
            <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-widest">
              Showroom Reference ID
            </span>
            <span className="text-3xl font-mono font-extrabold text-red-600 mt-2 block tracking-widest">
              {orderResult.order_reference}
            </span>
            <div className="mt-3 inline-flex items-center gap-1.5">
              {isApproved ? (
                <span className="px-3 py-1 text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle size={11} /> Approved • Reserved for 5 Days
                </span>
              ) : (
                <span className="px-3 py-1 text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} /> Pending Administrator Approval
                </span>
              )}
            </div>
          </div>

          {/* Customer & Order Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#F9F9F7] p-4 border border-gray-200/80">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Customer Details</span>
              <p className="font-semibold text-[#1A1A1A]">{name}</p>
              <p className="text-gray-600">{phone}</p>
              {email && <p className="text-gray-500 font-mono">{email}</p>}
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Order Details</span>
              <p className="text-gray-600">
                Date: <strong className="text-black">{new Date(orderResult.created_at || Date.now()).toLocaleDateString()}</strong>
              </p>
              <p className="text-gray-600">
                Total: <strong className="text-black font-mono">{formatCurrency(orderResult.total_amount)}</strong>
              </p>
            </div>
          </div>

          {/* Ordered Products Table */}
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-2">
              Reserved Products Breakdown
            </span>
            <div className="border border-gray-200 divide-y divide-gray-100 text-xs">
              {(orderResult.order_items || []).map((item: any) => (
                <div key={item.order_item_id || item.ospos_item_id} className="p-3.5 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">{item.product_name_snapshot}</h4>
                    <span className="text-[9.5px] text-gray-400 font-mono">
                      Quantity: {item.quantity} pcs • Price: {formatCurrency(item.unit_price)} each
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#1A1A1A]">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Showroom Instructions */}
          <div className="bg-[#D4C5B9]/15 border border-[#D4C5B9]/30 p-4 text-xs text-[#1A1A1A] leading-relaxed font-light space-y-1">
            <p className="font-semibold">💡 What is next?</p>
            <p>
              Present this Reference ID (<strong className="font-mono text-red-600">{orderResult.order_reference}</strong>) to our representatives at the <strong>Alahapperuma Trade Center showroom in Matara</strong> to inspect physical stock and complete your purchase.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Download size={14} />
              <span>Download Quotation PDF</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 border border-gray-300 hover:border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Printer size={14} />
              <span>Print Quotation</span>
            </button>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-black font-semibold uppercase tracking-widest transition-colors"
            >
              ← Return to Showroom Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // EMPTY CART SCREEN
  if (items.length === 0) {
    return (
      <div className="py-16 px-6 flex justify-center font-sans">
        <div className="w-full max-w-md p-8 border border-gray-200 bg-white shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
            <ShoppingBag size={28} />
          </div>
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Your Cart is Empty</h2>
          <p className="text-xs text-gray-500 font-light leading-relaxed">
            There are no products in your cart to generate a showroom quotation.
          </p>
          <Link
            href="/cart"
            className="inline-block w-full bg-[#1A1A1A] text-white hover:bg-[#D4C5B9] hover:text-[#1A1A1A] font-semibold text-xs tracking-widest uppercase py-3.5 transition-all"
          >
            Return to Cart
          </Link>
        </div>
      </div>
    );
  }

  // CHECKOUT FORM SCREEN
  return (
    <div className="py-12 px-6 flex justify-center font-sans">
      <div className="w-full max-w-lg p-8 border border-gray-200 bg-white shadow-sm space-y-6">
        <div>
          <Link
            href="/cart"
            className="text-[10px] font-bold tracking-widest text-gray-400 hover:text-[#1A1A1A] uppercase flex items-center gap-1.5 mb-4"
          >
            <ArrowLeft size={11} /> Back to Cart
          </Link>
          <h2 className="text-xl font-semibold text-[#1A1A1A] tracking-wide flex items-center gap-2.5">
            <FileText className="text-[#D4C5B9]" size={20} /> Showroom Quotation Reference
          </h2>
          <p className="text-xs text-gray-500 font-light mt-1.5 leading-relaxed">
            Provide customer details to create your order and lock in active inventory reservations at our Matara POS.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
              Your Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
              placeholder="e.g. Supun Gunasinghe"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
              placeholder="e.g. +94 77 123 4567"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
              placeholder="e.g. name@domain.com"
            />
          </div>

          {/* Cart Items Preview Summary */}
          <div className="bg-[#F9F9F7] p-4 border border-gray-200 space-y-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
              Cart Summary ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
            <div className="divide-y divide-gray-200 text-xs">
              {items.map((cartItem) => (
                <div key={cartItem.osposItemId} className="py-2 flex justify-between">
                  <span className="text-gray-700">
                    {cartItem.item.name} <strong>x{cartItem.quantity}</strong>
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(cartItem.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-widest uppercase py-4 transition-all duration-300 mt-2 block text-center disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Creating Order & Reserving Stock...</span>
              </>
            ) : (
              <span>Generate Showroom Quotation</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
