'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Loader2, ArrowLeft, AlertTriangle, ShieldAlert, Clock, Warehouse } from 'lucide-react';
import { useAuth } from '../../../../features/auth/AuthContext';
import Link from 'next/link';

interface NotificationItem {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

const API_BASE = 'http://localhost:4000/api';

export default function AdminNotificationsPage() {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ALL' | 'UNREAD' | 'ORDERS' | 'INVENTORY'>('ALL');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${savedToken || ''}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to load administrator notifications (${res.status})`);
      }
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${savedToken || ''}` },
      });
      fetchNotifications();
    } catch (err) {
      // Silently handle
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${savedToken || ''}` },
      });
      fetchNotifications();
    } catch (err) {
      // Silently handle
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (tab === 'UNREAD') return !n.is_read;
    if (tab === 'ORDERS') {
      return (
        n.type === 'order' ||
        n.type === 'order_approval_required' ||
        n.type === 'reservation_expired' ||
        n.title.toLowerCase().includes('order') ||
        n.title.toLowerCase().includes('reservation')
      );
    }
    if (tab === 'INVENTORY') {
      return (
        n.type === 'low_stock' ||
        n.type === 'out_of_stock' ||
        n.type === 'stock_recovered' ||
        n.title.toLowerCase().includes('stock')
      );
    }
    return true;
  });

  const getTypeBadge = (type: string | null, title: string) => {
    if (type === 'out_of_stock' || title.toLowerCase().includes('out of stock')) {
      return (
        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-rose-600 text-white uppercase tracking-wider rounded-full flex items-center gap-1">
          <AlertTriangle size={9} /> Out of Stock
        </span>
      );
    }
    if (type === 'low_stock' || title.toLowerCase().includes('low stock')) {
      return (
        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-amber-500 text-white uppercase tracking-wider rounded-full flex items-center gap-1">
          <Warehouse size={9} /> Low Stock
        </span>
      );
    }
    if (type === 'order_approval_required' || title.toLowerCase().includes('approval')) {
      return (
        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-purple-600 text-white uppercase tracking-wider rounded-full flex items-center gap-1">
          <ShieldAlert size={9} /> Action Required
        </span>
      );
    }
    if (type === 'reservation_expired' || title.toLowerCase().includes('expired')) {
      return (
        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-gray-600 text-white uppercase tracking-wider rounded-full flex items-center gap-1">
          <Clock size={9} /> Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[8.5px] font-bold bg-[#1A1A1A] text-white uppercase tracking-wider rounded-full">
        System
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-8 shadow-sm">
        <div className="border-b border-gray-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/orders"
              className="text-[10px] font-bold text-gray-400 hover:text-[#1A1A1A] uppercase tracking-widest flex items-center gap-1.5 mb-2"
            >
              <ArrowLeft size={11} /> Back to Orders
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] flex items-center gap-3">
              <Bell size={22} className="text-[#8C7A6B]" />
              <span>Administrator Notifications</span>
            </h1>
            <p className="text-xs text-gray-400 font-light mt-1">
              Real-time operational alerts for low stock thresholds, order approval requests, and stock reservation expirations.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 text-[10px] bg-[#1A1A1A] text-white hover:bg-black font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 shrink-0"
            >
              <CheckCheck size={14} />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 mt-6 gap-3 overflow-x-auto">
          <button
            onClick={() => setTab('ALL')}
            className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${
              tab === 'ALL'
                ? 'border-[#1A1A1A] text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Alerts ({notifications.length})
          </button>
          <button
            onClick={() => setTab('UNREAD')}
            className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'UNREAD'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setTab('ORDERS')}
            className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${
              tab === 'ORDERS'
                ? 'border-purple-600 text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Order Alerts
          </button>
          <button
            onClick={() => setTab('INVENTORY')}
            className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${
              tab === 'INVENTORY'
                ? 'border-amber-600 text-[#1A1A1A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Inventory Thresholds
          </button>
        </div>

        {/* List Content */}
        <div className="pt-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
              <span className="text-xs font-light uppercase tracking-wider font-mono">
                Loading administrator alert log...
              </span>
            </div>
          ) : error ? (
            <div className="py-12 border border-dashed border-red-200 bg-red-50/30 text-center text-red-700 px-6">
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={fetchNotifications}
                className="mt-4 px-4 py-2 text-[10px] bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-widest"
              >
                Retry
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-gray-200 bg-[#F9F9F7] space-y-3">
              <Bell size={28} className="text-gray-300 mx-auto" />
              <p className="text-gray-600 font-semibold text-sm">No notification records found.</p>
              <p className="text-gray-400 text-xs font-light">
                System alerts will appear here when inventory thresholds are crossed or orders require administrator action.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleMarkOneRead(n.notification_id)}
                  className={`p-5 border transition-all cursor-pointer ${
                    !n.is_read
                      ? 'bg-amber-50/40 border-amber-300 border-l-4 border-l-amber-500 shadow-xs'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(n.type, n.title)}
                        <h3 className={`text-sm ${!n.is_read ? 'font-bold text-amber-950' : 'font-semibold text-[#1A1A1A]'}`}>
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <span className="px-1.5 py-0.5 text-[8px] font-bold bg-amber-500 text-white uppercase tracking-wider rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 font-light leading-relaxed">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
