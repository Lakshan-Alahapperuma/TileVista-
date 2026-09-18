'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Download,
  Printer,
  X,
  User,
  ShoppingBag,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency } from '../../utils';
import { downloadQuotationPDF, PDFOrderData } from '../../utils/pdfGenerator';
import Link from 'next/link';

interface OrderItem {
  order_item_id: string;
  ospos_item_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sku?: string;
}

interface InventoryReservation {
  reservation_id: string;
  ospos_item_id: number;
  quantity: number;
  expires_at: string;
  status: 'active' | 'released' | 'expired' | 'completed';
}

interface OrderHistory {
  history_id: string;
  status: string;
  remarks: string | null;
  changed_at: string;
}

interface Order {
  order_id: string;
  order_reference: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  approval_type: 'auto' | 'manual';
  payment_status: 'pending' | 'paid' | 'failed';
  created_at: string;
  confirmed_at?: string | null;
  order_items: OrderItem[];
  inventory_reservations: InventoryReservation[];
  order_status_history?: OrderHistory[];
  users?: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
}

interface SummaryCounts {
  total: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const CustomerDashboard: React.FC = () => {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Authentication & Role Protection Guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/dashboard');
        return;
      }
      const userRole = (user?.role || '').toUpperCase();
      if (userRole === 'ADMIN' || userRole === 'ADMINISTRATOR') {
        router.push('/admin/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchCustomerOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const headers = { Authorization: `Bearer ${savedToken || ''}` };

      const [summaryRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/orders/my-orders/summary`, { headers }),
        fetch(
          `${API_BASE}/orders/my-orders?status=${statusTab}&search=${encodeURIComponent(search)}`,
          { headers }
        ),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      if (!listRes.ok) {
        throw new Error(`Unable to load orders list (${listRes.status})`);
      }

      const listData = await listRes.json();
      setOrders(listData);
    } catch (err: any) {
      setError(err.message || 'Unable to load your orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, statusTab, search]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCustomerOrders();
    }
  }, [isAuthenticated, fetchCustomerOrders]);

  const handleDownloadPDF = (order: Order) => {
    const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Valued Customer';
    const pdfData: PDFOrderData = {
      orderReference: order.order_reference,
      customerName: customerName || user?.email || 'Customer',
      phone: order.users?.phone || 'N/A',
      email: user?.email || undefined,
      createdAt: order.created_at,
      status: order.status,
      approvalType: order.approval_type,
      totalAmount: Number(order.total_amount),
      items: order.order_items.map((item) => ({
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <Clock size={11} className="text-amber-600 shrink-0" />
            <span>Waiting for Approval</span>
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <CheckCircle size={11} className="text-emerald-600 shrink-0" />
            <span>Approved</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-[9.5px] font-bold bg-blue-50 text-blue-800 border border-blue-300 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <CheckCircle size={11} className="text-blue-600 shrink-0" />
            <span>Completed</span>
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 text-[9.5px] font-bold bg-rose-50 text-rose-800 border border-rose-300 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <XCircle size={11} className="text-rose-600 shrink-0" />
            <span>{status === 'rejected' ? 'Rejected' : 'Cancelled'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[9.5px] font-bold bg-gray-100 text-gray-700 border border-gray-200 rounded-full uppercase tracking-wider w-fit">
            {status}
          </span>
        );
    }
  };

  const getReservationBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Stock Reserved</span>
          </span>
        );
      case 'released':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200 rounded-full uppercase tracking-wider">
            Reservation Released
          </span>
        );
      case 'expired':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-gray-200 text-gray-700 border border-gray-300 rounded-full uppercase tracking-wider">
            Reservation Expired
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full uppercase tracking-wider">
            Purchase Completed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-gray-100 text-gray-600 rounded-full uppercase tracking-wider">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F9F9F7] py-20 flex flex-col items-center justify-center font-sans text-gray-400 gap-3">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
        <span className="text-xs uppercase font-light tracking-wider">Loading your customer portal...</span>
      </div>
    );
  }

  const customerDisplayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Valued Customer';

  return (
    <div className="py-10 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-8">
      {/* 1. Customer Welcome & Profile Banner (Redesigned to warm showroom aesthetic) */}
      <div className="bg-white border border-gray-200 border-l-4 border-l-[#D4C5B9] text-[#1A1A1A] p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#8C7A6B] uppercase block mb-1.5 font-mono">
            Showroom Customer Portal
          </span>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1A1A]">
            Welcome back, {customerDisplayName || 'Customer'}
          </h1>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-xl leading-relaxed">
            Track your showroom quotations, inspect active stock reservation periods, and manage your account details.
          </p>
        </div>

        <Link
          href="/account"
          className="bg-[#F9F9F7] border border-gray-200 p-4 text-xs space-y-1.5 w-full md:w-auto hover:border-[#D4C5B9] transition-all group block"
        >
          <div className="flex items-center justify-between gap-4 text-[#8C7A6B] font-bold uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5">
              <User size={12} />
              <span>Account Details</span>
            </span>
            <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-gray-700 font-mono text-[11px]">{user?.email}</p>
          <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-widest block pt-0.5">
            Manage Profile & Security →
          </span>
        </Link>
      </div>

      {/* 2. Customer Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setStatusTab('ALL')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'ALL'
              ? 'bg-[#F3EFE9] text-[#1A1A1A] border-[#D4C5B9] shadow-sm font-semibold'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-gray-400'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block text-[#8C7A6B]">Total Orders</span>
          <span className="text-2xl font-bold font-mono block mt-2 text-[#1A1A1A]">{summary.total}</span>
          <span className="text-[8.5px] text-gray-500 block mt-1">All Time Requests</span>
        </button>

        <button
          onClick={() => setStatusTab('PENDING')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'PENDING'
              ? 'bg-amber-50 text-amber-900 border-amber-400 shadow-sm font-semibold'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-amber-400'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block text-amber-800">Waiting Approval</span>
          <span className="text-2xl font-bold font-mono block mt-2 text-amber-900">{summary.pending}</span>
          <span className="text-[8.5px] text-amber-700 block mt-1">Under Review</span>
        </button>

        <button
          onClick={() => setStatusTab('APPROVED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'APPROVED'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-sm font-semibold'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-emerald-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block text-emerald-800">Approved</span>
          <span className="text-2xl font-bold font-mono block mt-2 text-emerald-900">{summary.approved}</span>
          <span className="text-[8.5px] text-emerald-700 block mt-1">Showroom Collection</span>
        </button>

        <button
          onClick={() => setStatusTab('COMPLETED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'COMPLETED'
              ? 'bg-blue-50 text-blue-900 border-blue-400 shadow-sm font-semibold'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-blue-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block text-blue-800">Completed</span>
          <span className="text-2xl font-bold font-mono block mt-2 text-blue-900">{summary.completed}</span>
          <span className="text-[8.5px] text-blue-700 block mt-1">Finalized Sales</span>
        </button>

        <button
          onClick={() => setStatusTab('REJECTED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'REJECTED'
              ? 'bg-rose-50 text-rose-900 border-rose-400 shadow-sm font-semibold'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-rose-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block text-rose-800">Rejected</span>
          <span className="text-2xl font-bold font-mono block mt-2 text-rose-900">{summary.rejected}</span>
          <span className="text-[8.5px] text-rose-700 block mt-1">Reservations Released</span>
        </button>
      </div>

      {/* 3. Main Orders Management Card */}
      <div className="bg-white border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
        {/* Header & Reload */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase flex items-center gap-2">
              <Package className="text-[#D4C5B9]" size={18} />
              <span>My Showroom Quotations & Orders</span>
            </h3>
            <p className="text-[11px] text-gray-500 font-light mt-0.5">
              Review order references, active reservation expiration dates, and item breakdowns.
            </p>
          </div>

          <button
            onClick={fetchCustomerOrders}
            disabled={loading}
            className="border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[10px] tracking-wider uppercase px-4 py-2.5 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh My Orders</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusTab('ALL')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 whitespace-nowrap ${
              statusTab === 'ALL'
                ? 'border-[#1A1A1A] text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Orders ({summary.total})
          </button>
          <button
            onClick={() => setStatusTab('PENDING')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'PENDING'
                ? 'border-amber-500 text-amber-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Waiting Approval ({summary.pending})
          </button>
          <button
            onClick={() => setStatusTab('APPROVED')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'APPROVED'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Approved ({summary.approved})
          </button>
          <button
            onClick={() => setStatusTab('COMPLETED')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'COMPLETED'
                ? 'border-blue-600 text-blue-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Completed ({summary.completed})
          </button>
          <button
            onClick={() => setStatusTab('REJECTED')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'REJECTED'
                ? 'border-rose-600 text-rose-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Rejected ({summary.rejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="flex flex-col md:flex-row gap-4 bg-[#F9F9F7] border border-gray-200 p-3.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by order reference (e.g. QT-72354-MATARA) or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 px-4 py-2.5 pl-9 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light"
            />
            <Search size={13} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2.5 text-[10px] bg-white border border-gray-200 text-gray-500 hover:text-black uppercase font-bold tracking-widest"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Orders List View */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
            <span className="text-xs font-light tracking-wider uppercase">Loading your orders...</span>
          </div>
        ) : error ? (
          <div className="py-12 border border-dashed border-red-200 bg-red-50/20 text-center text-red-600 px-6">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchCustomerOrders}
              className="mt-4 px-4 py-2 text-[10px] bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-widest"
            >
              Retry Connection
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-gray-200 bg-[#F9F9F7] space-y-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <ShoppingBag size={22} />
            </div>
            <div>
              <p className="text-gray-600 font-semibold text-sm">
                {statusTab === 'ALL' ? "You haven't placed any orders yet." : `No ${statusTab.toLowerCase()} orders found.`}
              </p>
              <p className="text-gray-400 text-xs font-light mt-1">
                Browse our showroom products and design packages to generate a quotation.
              </p>
            </div>
            <Link
              href="/products/tiles"
              className="inline-block px-6 py-3 bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-3">Order Reference</th>
                    <th className="py-4 px-3">Date Placed</th>
                    <th className="py-4 px-3">Ordered Items</th>
                    <th className="py-4 px-3">Total Amount</th>
                    <th className="py-4 px-3">Order Status</th>
                    <th className="py-4 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-[#F9F9F7] transition-colors">
                      <td className="py-4 px-3 font-mono font-bold text-red-600">
                        {order.order_reference}
                      </td>
                      <td className="py-4 px-3 font-mono text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-3">
                        <span className="font-semibold text-[#1A1A1A] block">
                          {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate max-w-xs block">
                          {order.order_items.map((i) => `${i.product_name_snapshot} (x${i.quantity})`).join(', ')}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-[#1A1A1A]">
                        {formatCurrency(Number(order.total_amount))}
                      </td>
                      <td className="py-4 px-3">{getStatusBadge(order.status)}</td>
                      <td className="py-4 px-3 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3.5 py-1.5 text-[9px] font-bold bg-[#8C7A6B] text-white hover:bg-[#1A1A1A] uppercase tracking-widest inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye size={10} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => (
                <div key={order.order_id} className="bg-[#F9F9F7] border border-gray-200 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-red-600 text-sm block">
                        {order.order_reference}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Placed on {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="text-xs text-gray-700">
                    <span className="font-medium block">
                      {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}:
                    </span>
                    <span className="text-[11px] text-gray-500 font-light block mt-0.5">
                      {order.order_items.map((i) => i.product_name_snapshot).join(', ')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-mono font-bold text-[#1A1A1A] text-sm">
                      {formatCurrency(Number(order.total_amount))}
                    </span>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1.5 text-[9px] font-bold bg-[#1A1A1A] text-white hover:bg-black uppercase tracking-widest inline-flex items-center gap-1"
                    >
                      <Eye size={10} />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 w-full max-w-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 space-y-6">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase font-mono">
                  Showroom Quotation Details / Ref: {selectedOrder.order_reference}
                </span>
                <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mt-0.5 flex items-center gap-2">
                  <span>Order Reference {selectedOrder.order_reference}</span>
                </h3>
                <p className="text-xs text-gray-400 font-light mt-0.5">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()} • Total Amount: {formatCurrency(Number(selectedOrder.total_amount))}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 text-gray-400 hover:text-black transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Status Explanations (Section 9, 10, 11) */}
            {selectedOrder.status === 'pending' && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px] text-amber-800">
                  <Clock size={13} />
                  <span>Order Status: Waiting for Administrator Approval</span>
                </div>
                <p>
                  Your order is currently waiting for administrator review. The requested stock is being <strong>actively reserved</strong> while your order is under evaluation.
                </p>
              </div>
            )}

            {selectedOrder.status === 'approved' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px] text-emerald-800">
                  <CheckCircle size={13} />
                  <span>Order Status: Approved for Showroom Collection</span>
                </div>
                <p>
                  Your order has been approved! Present your Showroom Reference ID (<strong className="font-mono text-red-600">{selectedOrder.order_reference}</strong>) at the <strong>Alahapperuma Trade Center showroom in Matara</strong> to collect your items.
                </p>
              </div>
            )}

            {(selectedOrder.status === 'rejected' || selectedOrder.status === 'cancelled') && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px] text-rose-800">
                  <XCircle size={13} />
                  <span>Order Status: Rejected / Cancelled</span>
                </div>
                <p>
                  This order was rejected or cancelled. Associated active stock reservations have been released.
                </p>
                {/* Future Rejection Notification Placeholder Container (Section 11 & 22) */}
                <div className="p-3 bg-white/80 border border-rose-200 text-[11px] rounded-none">
                  <span className="font-bold text-rose-800 block text-[9.5px] uppercase tracking-wider mb-1">
                    Administrator Update & Notification Log
                  </span>
                  <p className="text-gray-600 font-light italic">
                    {selectedOrder.order_status_history?.find((h) => h.status === 'rejected')?.remarks ||
                      'No custom message logged for this order.'}
                  </p>
                </div>
              </div>
            )}

            {/* Customer Details Block */}
            <div className="bg-[#F9F9F7] p-4 border border-gray-200/80 rounded-sm">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-2">
                Customer Information
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Name</span>
                  <span className="font-semibold text-[#1A1A1A]">{customerDisplayName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Email</span>
                  <span className="font-mono text-gray-700">{user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Phone</span>
                  <span className="font-mono text-gray-700">{selectedOrder.users?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Ordered Items Breakdown */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                Ordered Products
              </span>
              <div className="border border-gray-200 divide-y divide-gray-100 text-xs">
                {selectedOrder.order_items.map((item) => (
                  <div key={item.order_item_id} className="p-3.5 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-[#1A1A1A]">{item.product_name_snapshot}</h4>
                      <span className="text-[9.5px] text-gray-400 font-mono">
                        Quantity: {item.quantity} pcs • Unit Price: {formatCurrency(Number(item.unit_price))}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#1A1A1A]">
                      {formatCurrency(Number(item.subtotal))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reservation Details (Section 12) */}
            <div className="bg-[#F9F9F7] p-4 border border-gray-200/80 space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                TileVista Inventory Reservation Status
              </span>
              {selectedOrder.inventory_reservations && selectedOrder.inventory_reservations.length > 0 ? (
                <div className="divide-y divide-gray-200 border border-gray-200 bg-white text-xs">
                  {selectedOrder.inventory_reservations.map((res) => (
                    <div key={res.reservation_id} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-[#1A1A1A] block">
                          Reserved Quantity: {res.quantity} pcs
                        </span>
                        <span className="text-[9.5px] text-gray-400 font-mono">ID: {res.reservation_id}</span>
                      </div>
                      <div className="text-right">
                        {getReservationBadge(res.status)}
                        {res.expires_at && (
                          <span className="text-[9.5px] text-gray-500 block mt-1">
                            Expires: {new Date(res.expires_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-light">No reservation records linked.</p>
              )}
            </div>

            {/* Order Timeline Visualizer */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                Order Progress Timeline
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                  ✓ 1. Placed
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                  ✓ 2. Stock Reserved
                </div>
                <div
                  className={`p-2.5 border font-bold ${
                    selectedOrder.status === 'approved' || selectedOrder.status === 'completed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : selectedOrder.status === 'pending'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}
                >
                  {selectedOrder.status === 'approved' || selectedOrder.status === 'completed'
                    ? '✓ 3. Approved'
                    : selectedOrder.status === 'pending'
                    ? '⏳ 3. Pending Review'
                    : '✕ 3. Rejected'}
                </div>
                <div
                  className={`p-2.5 border font-bold ${
                    selectedOrder.status === 'completed'
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}
                >
                  {selectedOrder.status === 'completed' ? '✓ 4. Showroom Completed' : '4. Showroom Collection'}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => handleDownloadPDF(selectedOrder)}
                className="px-4 py-2.5 text-[10px] bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold uppercase tracking-widest inline-flex items-center justify-center gap-1.5"
              >
                <Download size={12} />
                <span>Download Quotation PDF</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 text-[10px] bg-white border border-gray-300 hover:border-[#1A1A1A] text-gray-700 font-bold uppercase tracking-widest inline-flex items-center justify-center gap-1.5"
              >
                <Printer size={12} />
                <span>Print Quotation</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2.5 text-[10px] bg-white border border-gray-200 text-gray-600 hover:text-black font-bold uppercase tracking-widest"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
