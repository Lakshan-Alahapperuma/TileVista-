'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Loader2, RefreshCw, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../features/auth/AuthContext';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ALL' | 'UNREAD' | 'ORDERS'>('ALL');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/notifications');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const savedToken = token || localStorage.getItem('tilevista_token');
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to load notifications (${res.status})`);
      }
      const data = await res.json();
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const savedToken = token || localStorage.getItem('tilevista_token');
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      fetchNotifications();
    } catch (err) {
      // Silently handle
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      const savedToken = token || localStorage.getItem('tilevista_token');
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      fetchNotifications();
    } catch (err) {
      // Silently handle
    }
  };

  if (authLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3 font-sans">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
        <span className="text-xs uppercase font-light tracking-wider">Verifying authentication...</span>
      </div>
    );
  }

  const filteredNotifications = notifications.filter((n) => {
    if (tab === 'UNREAD') return !n.is_read;
    if (tab === 'ORDERS') return n.type === 'order' || n.title.toLowerCase().includes('order');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="py-10 font-sans max-w-5xl mx-auto px-4 md:px-8 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-gray-500 hover:text-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft size={12} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1A1A] flex items-center gap-3">
            <Bell size={24} className="text-[#8C7A6B]" />
            <span>Customer Notifications</span>
          </h1>
          <p className="text-xs text-gray-500 font-light mt-1">
            Stay updated on showroom quotation approvals, active inventory reservation alerts, and account messages.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 text-[10px] bg-[#8C7A6B] text-white hover:bg-[#1A1A1A] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 shrink-0"
          >
            <CheckCheck size={14} />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 gap-3">
        <button
          onClick={() => setTab('ALL')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${
            tab === 'ALL'
              ? 'border-[#1A1A1A] text-[#1A1A1A]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setTab('UNREAD')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'UNREAD'
              ? 'border-amber-500 text-amber-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setTab('ORDERS')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${
            tab === 'ORDERS'
              ? 'border-[#8C7A6B] text-[#1A1A1A]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Order Updates
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
          <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
          <span className="text-xs font-light uppercase tracking-wider">Loading notification history...</span>
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
          <p className="text-gray-600 font-semibold text-sm">No notifications found.</p>
          <p className="text-gray-400 text-xs font-light">
            You will receive notification updates here when your showroom orders are updated.
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold ${!n.is_read ? 'text-amber-950 font-bold' : 'text-[#1A1A1A]'}`}>
                      {n.title}
                    </h3>
                    {!n.is_read && (
                      <span className="px-2 py-0.5 text-[8.5px] font-bold bg-amber-500 text-white uppercase tracking-wider rounded-full">
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
  );
}
