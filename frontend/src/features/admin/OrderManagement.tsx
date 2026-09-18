'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  X,
  User,
  Package,
  Calendar,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '../../utils';

interface OrderItem {
  order_item_id: string;
  ospos_item_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  physicalStock?: number;
  activeReserved?: number;
  effectiveAvailable?: number;
  threshold?: number | null;
  remainingAfterOrder?: number;
  approvalRequired?: boolean;
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
  users?: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    user_addresses?: any[];
  };
  order_items: OrderItem[];
  inventory_reservations: InventoryReservation[];
  order_status_history?: OrderHistory[];
  hasApprovalTrigger?: boolean;
}

interface SummaryCounts {
  needsApproval: number;
  approved: number;
  active: number;
  completed: number;
  rejected: number;
  expired: number;
}

export const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({
    needsApproval: 0,
    approved: 0,
    active: 0,
    completed: 0,
    rejected: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<string>('NEEDS_APPROVAL');
  const [search, setSearch] = useState<string>('');

  // Modal States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const API_BASE = 'http://localhost:4000/api';

  const fetchOrdersData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const headers = { Authorization: `Bearer ${token || ''}` };

      const [summaryRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/orders/admin/summary-counts`, { headers }),
        fetch(`${API_BASE}/orders/admin/list?status=${statusTab}&search=${encodeURIComponent(search)}`, { headers }),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      if (!listRes.ok) {
        throw new Error(`Failed to fetch orders (${listRes.status})`);
      }

      const listData = await listRes.json();
      setOrders(listData);
    } catch (err: any) {
      setError(err.message || 'Error loading orders database');
    } finally {
      setLoading(false);
    }
  }, [statusTab, search]);

  useEffect(() => {
    fetchOrdersData();
  }, [fetchOrdersData]);

  const handleApproveOrder = async () => {
    if (!selectedOrder) return;
    setProcessing(true);
    setActionSuccess(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/orders/admin/${selectedOrder.order_id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to approve order');
      }

      setActionSuccess(`Order "${selectedOrder.order_reference}" successfully approved!`);
      setShowApproveConfirm(false);
      setSelectedOrder(null);
      fetchOrdersData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error approving order');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a valid rejection reason.');
      return;
    }

    setProcessing(true);
    setActionSuccess(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/orders/admin/${selectedOrder.order_id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to reject order');
      }

      setActionSuccess(`Order "${selectedOrder.order_reference}" rejected and active stock reservations released.`);
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedOrder(null);
      fetchOrdersData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error rejecting order');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (order: Order) => {
    if (order.status === 'pending' && order.approval_type === 'manual') {
      return (
        <span className="px-2.5 py-1 text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
          <Clock size={10} className="text-amber-600" />
          <span>Needs Approval</span>
        </span>
      );
    }

    switch (order.status) {
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full uppercase tracking-wider flex items-center gap-1">
            <CheckCircle size={10} className="text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-full uppercase tracking-wider flex items-center gap-1">
            <CheckCircle size={10} className="text-blue-600" />
            <span>Completed</span>
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 rounded-full uppercase tracking-wider flex items-center gap-1">
            <XCircle size={10} className="text-rose-600" />
            <span>{order.status === 'rejected' ? 'Rejected' : 'Cancelled'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200 rounded-full uppercase tracking-wider">
            {order.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between rounded-sm shadow-xs animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Needs Approval Card */}
        <button
          onClick={() => setStatusTab('NEEDS_APPROVAL')}
          className={`p-4 text-left border transition-all relative overflow-hidden ${
            statusTab === 'NEEDS_APPROVAL'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
              : 'bg-white text-[#1A1A1A] border-amber-200 hover:border-amber-400 bg-amber-50/20'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Needs Approval</span>
            <ShieldAlert size={14} className={statusTab === 'NEEDS_APPROVAL' ? 'text-white' : 'text-amber-600'} />
          </div>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.needsApproval}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">Action Required Queue</span>
        </button>

        {/* Approved Card */}
        <button
          onClick={() => setStatusTab('APPROVED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'APPROVED'
              ? 'bg-emerald-700 text-white border-emerald-800 shadow-md'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-emerald-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Approved</span>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.approved}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">Awaiting Collection</span>
        </button>

        {/* Active Orders Card */}
        <button
          onClick={() => setStatusTab('ACTIVE')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'ACTIVE'
              ? 'bg-[#1A1A1A] text-white border-black shadow-md'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-black'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Active Orders</span>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.active}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">Pending & Approved</span>
        </button>

        {/* Completed Card */}
        <button
          onClick={() => setStatusTab('COMPLETED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'COMPLETED'
              ? 'bg-blue-700 text-white border-blue-800 shadow-md'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-blue-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Completed</span>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.completed}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">Reconciled Sales</span>
        </button>

        {/* Rejected Card */}
        <button
          onClick={() => setStatusTab('REJECTED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'REJECTED'
              ? 'bg-rose-700 text-white border-rose-800 shadow-md'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-rose-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Rejected</span>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.rejected}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">Reservations Released</span>
        </button>

        {/* Expired Card */}
        <button
          onClick={() => setStatusTab('EXPIRED')}
          className={`p-4 text-left border transition-all ${
            statusTab === 'EXPIRED'
              ? 'bg-gray-700 text-white border-gray-800 shadow-md'
              : 'bg-white text-[#1A1A1A] border-gray-200 hover:border-gray-500'
          }`}
        >
          <span className="text-[9px] font-bold tracking-widest uppercase block opacity-80">Expired</span>
          <span className="text-2xl font-bold font-mono block mt-2">{summary.expired}</span>
          <span className="text-[8.5px] opacity-75 block mt-1">5-Day Timeout</span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white border border-gray-200 p-8 shadow-sm">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase flex items-center gap-2">
              <Receipt className="text-[#D4C5B9]" size={18} />
              <span>Customer Orders & Approval Queue</span>
            </h3>
            <p className="text-[10px] text-gray-400 font-light mt-0.5">
              Review order threshold impacts, manage active inventory reservations, and approve or reject orders.
            </p>
          </div>

          <button
            onClick={fetchOrdersData}
            disabled={loading}
            className="border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[10px] tracking-wider uppercase px-4 py-2.5 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Reload Orders</span>
          </button>
        </div>

        {/* Status Tabs Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusTab('NEEDS_APPROVAL')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'NEEDS_APPROVAL'
                ? 'border-amber-500 text-amber-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-ping"></span>
            Needs Approval ({summary.needsApproval})
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
            onClick={() => setStatusTab('ACTIVE')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'ACTIVE'
                ? 'border-[#1A1A1A] text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Active Orders ({summary.active})
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
            Rejected / Cancelled ({summary.rejected})
          </button>
          <button
            onClick={() => setStatusTab('EXPIRED')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              statusTab === 'EXPIRED'
                ? 'border-gray-500 text-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Expired ({summary.expired})
          </button>
          <button
            onClick={() => setStatusTab('ALL')}
            className={`pb-3 px-3 text-[11px] font-bold tracking-wider uppercase transition-colors border-b-2 whitespace-nowrap ${
              statusTab === 'ALL'
                ? 'border-[#1A1A1A] text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Orders
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-[#F9F9F7] border border-gray-200 p-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by order reference, customer name, email, phone..."
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

        {/* Orders Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
            <span className="text-xs font-light tracking-wider uppercase">Loading customer order queue...</span>
          </div>
        ) : error ? (
          <div className="py-12 border border-dashed border-red-200 bg-red-50/20 text-center text-red-600 px-6">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchOrdersData}
              className="mt-4 px-4 py-2 text-[10px] bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-widest"
            >
              Retry Connection
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-gray-200 bg-[#F9F9F7]">
            <p className="text-gray-400 font-light text-xs uppercase tracking-wider">
              {statusTab === 'NEEDS_APPROVAL'
                ? 'No orders currently requiring manual administrator approval.'
                : 'No orders found matching current criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-3">Order Reference</th>
                  <th className="py-4 px-3">Customer</th>
                  <th className="py-4 px-3">Items / Products</th>
                  <th className="py-4 px-3">Total Value</th>
                  <th className="py-4 px-3 text-center">Status</th>
                  <th className="py-4 px-3 text-center">Placed At</th>
                  <th className="py-4 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const customerName = order.users
                    ? `${order.users.first_name} ${order.users.last_name}`
                    : 'Registered Customer';
                  const isPendingApproval = order.status === 'pending' && order.approval_type === 'manual';

                  return (
                    <tr
                      key={order.order_id}
                      className={`transition-colors ${
                        isPendingApproval ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-[#F9F9F7]'
                      }`}
                    >
                      <td className="py-4 px-3 font-mono font-bold text-red-600">
                        {order.order_reference}
                      </td>
                      <td className="py-4 px-3">
                        <span className="font-semibold text-[#1A1A1A] block">{customerName}</span>
                        <span className="text-[10px] text-gray-400 block">{order.users?.email || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-3">
                        <span className="font-medium text-[#1A1A1A] block">
                          {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate max-w-xs block">
                          {order.order_items.map((i) => `${i.product_name_snapshot} (x${i.quantity})`).join(', ')}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-[#1A1A1A]">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="py-4 px-3 text-center">{getStatusBadge(order)}</td>
                      <td className="py-4 px-3 text-center font-mono text-[10.5px] text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}{' '}
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 text-[9px] font-bold bg-[#1A1A1A] text-white hover:bg-black uppercase tracking-widest flex items-center gap-1"
                          >
                            <Eye size={10} />
                            <span>Review</span>
                          </button>

                          {isPendingApproval && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowApproveConfirm(true);
                                }}
                                className="px-3 py-1.5 text-[9px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 uppercase tracking-widest flex items-center gap-1"
                              >
                                <CheckCircle size={10} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowRejectModal(true);
                                }}
                                className="px-3 py-1.5 text-[9px] font-bold bg-rose-600 text-white hover:bg-rose-700 uppercase tracking-widest flex items-center gap-1"
                              >
                                <XCircle size={10} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ORDER REVIEW & DETAILS MODAL */}
      {selectedOrder && !showApproveConfirm && !showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 w-full max-w-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 space-y-6">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase font-mono">
                  Order Management / Ref: {selectedOrder.order_reference}
                </span>
                <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mt-0.5">
                  Order Review & Inventory Audit
                </h3>
                <p className="text-xs text-gray-400 font-light mt-0.5">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()} • Value: {formatCurrency(selectedOrder.total_amount)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 text-gray-400 hover:text-black transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Customer Details Block */}
            <div className="bg-[#F9F9F7] p-4 border border-gray-200/80 rounded-sm">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-2">
                Customer Information
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Name</span>
                  <span className="font-semibold text-[#1A1A1A]">
                    {selectedOrder.users ? `${selectedOrder.users.first_name} ${selectedOrder.users.last_name}` : 'Registered Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Email</span>
                  <span className="font-mono text-gray-700">{selectedOrder.users?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Phone</span>
                  <span className="font-mono text-gray-700">{selectedOrder.users?.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase block">Approval Type</span>
                  <span className="font-semibold uppercase tracking-wider text-amber-700">
                    {selectedOrder.approval_type === 'manual' ? 'Requires Admin Approval' : 'Auto Approved'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Inventory Threshold Audit */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                Ordered Items & Stock Threshold Impact
              </span>
              <div className="space-y-3">
                {selectedOrder.order_items.map((item) => (
                  <div key={item.order_item_id} className="bg-white border border-gray-200 p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-[#1A1A1A] text-sm">{item.product_name_snapshot}</h4>
                        <span className="text-[10px] font-mono text-gray-400">OSPOS Item ID: {item.ospos_item_id}</span>
                      </div>
                      <span className="font-mono font-bold text-sm text-[#1A1A1A]">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center bg-[#F9F9F7] p-2.5 border border-gray-150">
                      <div>
                        <span className="text-[8.5px] font-bold text-gray-400 uppercase block">Requested</span>
                        <span className="font-mono font-bold text-[#1A1A1A]">{item.quantity} pcs</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-bold text-gray-400 uppercase block">OSPOS Physical</span>
                        <span className="font-mono font-bold text-gray-700">{item.physicalStock ?? 0} pcs</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-bold text-amber-700 uppercase block">Active Reserved</span>
                        <span className="font-mono font-bold text-amber-800">{item.activeReserved ?? 0} pcs</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-bold text-emerald-700 uppercase block">Effective Available</span>
                        <span className="font-mono font-bold text-emerald-800">{item.effectiveAvailable ?? 0} pcs</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-bold text-gray-500 uppercase block">Threshold</span>
                        <span className="font-mono font-bold text-gray-800">{item.threshold ?? 'Unconfigured'} pcs</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-bold text-purple-700 uppercase block">Remaining After</span>
                        <span className={`font-mono font-bold ${item.approvalRequired ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {item.remainingAfterOrder ?? 0} pcs
                        </span>
                      </div>
                    </div>

                    {item.approvalRequired && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-medium flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <span>
                          <strong>APPROVAL TRIGGER:</strong> Remaining stock ({item.remainingAfterOrder} pcs) would reach or fall below configured threshold ({item.threshold} pcs).
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reservation Visibility Section */}
            <div className="bg-[#F9F9F7] p-4 border border-gray-200/80 rounded-sm space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                TileVista Inventory Reservations
              </span>
              {selectedOrder.inventory_reservations && selectedOrder.inventory_reservations.length > 0 ? (
                <div className="divide-y divide-gray-200 border border-gray-200 bg-white text-xs">
                  {selectedOrder.inventory_reservations.map((res) => (
                    <div key={res.reservation_id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-gray-400 block">ID: {res.reservation_id}</span>
                        <span className="font-semibold text-[#1A1A1A]">
                          Reserved Quantity: {res.quantity} pcs
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded-full ${
                          res.status === 'active' ? 'bg-amber-100 text-amber-800' :
                          res.status === 'released' ? 'bg-rose-100 text-rose-800' :
                          res.status === 'expired' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          Status: {res.status}
                        </span>
                        {res.expires_at && (
                          <span className="text-[9.5px] text-gray-400 block mt-0.5">
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

            {/* Action Buttons inside Modal */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2.5 text-[10px] bg-white border border-gray-200 text-gray-600 hover:text-black font-bold uppercase tracking-widest"
              >
                Close View
              </button>

              {selectedOrder.status === 'pending' && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2.5 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <XCircle size={12} />
                    <span>Reject Order</span>
                  </button>
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    className="px-4 py-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    <span>Approve Order</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPROVAL CONFIRMATION DIALOG */}
      {showApproveConfirm && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle size={20} />
              <h4 className="font-bold text-base text-[#1A1A1A]">Approve Order?</h4>
            </div>
            <p className="text-xs text-gray-600 font-light">
              Are you sure you want to approve order <strong className="font-mono text-black">{selectedOrder.order_reference}</strong> for customer{' '}
              <strong>{selectedOrder.users ? `${selectedOrder.users.first_name} ${selectedOrder.users.last_name}` : 'Customer'}</strong>?
            </p>
            <div className="bg-[#F9F9F7] p-3 border border-gray-200 text-[11px] space-y-1">
              <div>Total Order Value: <strong>{formatCurrency(selectedOrder.total_amount)}</strong></div>
              <div>Reservation Status: <strong className="text-amber-700">Remains ACTIVE (Held for customer pickup)</strong></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="px-4 py-2 text-[10px] bg-white border border-gray-200 text-gray-600 font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveOrder}
                disabled={processing}
                className="px-4 py-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
              >
                {processing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <XCircle size={20} />
              <h4 className="font-bold text-base text-[#1A1A1A]">Reject Order</h4>
            </div>
            <p className="text-xs text-gray-600 font-light">
              Are you sure you want to reject order <strong className="font-mono text-black">{selectedOrder.order_reference}</strong>?
              This action will immediately set active stock reservations to <strong className="text-rose-700">RELEASED</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">
                Rejection Reason (Required)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Insufficient showroom stock available, stock reservation expired, or customer requested cancellation."
                className="w-full bg-[#F9F9F7] border border-gray-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-[10px] bg-white border border-gray-200 text-gray-600 font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={processing || !rejectionReason.trim()}
                className="px-4 py-2 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
              >
                {processing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
