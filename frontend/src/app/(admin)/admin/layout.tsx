'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '../../../features/auth/AdminGuard';
import { useAuth } from '../../../features/auth/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  Warehouse,
  LineChart,
  Grid3X3,
  Settings as SettingsIcon,
  LogOut,
  User,
  Box,
  Phone,
  MapPin,
  Bell,
  X,
  PackagePlus,
  MessageSquare,
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';
const POLL_INTERVAL_MS = 10_000; // Check every 10 seconds

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [lastKnownCount, setLastKnownCount] = useState<number | null>(null);
  const [showNewItemPulse, setShowNewItemPulse] = useState<boolean>(false);
  const [pendingInquiriesCount, setPendingInquiriesCount] = useState<number>(0);
  const [ordersApprovalCount, setOrdersApprovalCount] = useState<number>(0);
  const [seenOrdersCount, setSeenOrdersCount] = useState<number>(0);

  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState<number>(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);

  // Initialize seen orders count from localStorage on mount
  useEffect(() => {
    const savedSeen = localStorage.getItem('tilevista_admin_seen_orders_count');
    if (savedSeen !== null) {
      setSeenOrdersCount(parseInt(savedSeen, 10) || 0);
    }
  }, []);

  // When visiting /admin/orders, mark current orders count as seen so the badge disappears
  useEffect(() => {
    if (pathname === '/admin/orders') {
      setSeenOrdersCount(ordersApprovalCount);
      localStorage.setItem('tilevista_admin_seen_orders_count', ordersApprovalCount.toString());
    }
  }, [pathname, ordersApprovalCount]);

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      if (!token) return;

      const [listRes, countRes] = await Promise.all([
        fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setAdminNotifications(Array.isArray(listData) ? listData.slice(0, 5) : []);
      }
      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadAdminCount(countData.unreadCount || 0);
      }
    } catch {
      // Silently fail navigation notifications poll
    }
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      if (!token) return;
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAdminNotifications();
    } catch {
      // Silently handle error
    }
  };

  const handleMarkOneRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      if (!token) return;
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAdminNotifications();
    } catch {
      // Silently handle error
    }
  };

  const fetchPendingCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/admin/products/pending-review`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      const count = Array.isArray(data) ? data.length : 0;

      // Detect if NEW items appeared since last check
      if (lastKnownCount !== null && count > lastKnownCount) {
        setBannerDismissed(false); // Re-show banner if new items arrive
        setShowNewItemPulse(true);
        setTimeout(() => setShowNewItemPulse(false), 3000);
      }

      setPendingCount(count);
      setPendingItems(Array.isArray(data) ? data.slice(0, 5) : []); // Keep top 5 for preview
      setLastKnownCount(count);

      // Fetch pending inquiries
      const inqResponse = await fetch(`${API_BASE}/inquiries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (inqResponse.ok) {
        const inqData = await inqResponse.json();
        const pendingInqs = Array.isArray(inqData) ? inqData.filter((i: any) => i.status === 'pending').length : 0;
        setPendingInquiriesCount(pendingInqs);
      }

      // Fetch orders needing approval count
      const ordersRes = await fetch(`${API_BASE}/orders/admin/summary-counts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (ordersRes.ok) {
        const summaryData = await ordersRes.json();
        const count = summaryData.needsApproval || 0;
        setOrdersApprovalCount(count);
        if (pathname === '/admin/orders') {
          setSeenOrdersCount(count);
          localStorage.setItem('tilevista_admin_seen_orders_count', count.toString());
        }
      }

      // Fetch persistent admin notifications
      await fetchAdminNotifications();
    } catch {
      // Silently fail — don't break the admin panel over a notification check
    }
  }, [lastKnownCount, pathname, fetchAdminNotifications]);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // Global click listener to dismiss dropdown when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.admin-notification-container')) {
        setShowNotificationDropdown(false);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Calculate unread orders count: 0 if on /admin/orders page, else difference between current & seen
  const unreadOrdersCount = pathname === '/admin/orders'
    ? 0
    : Math.max(0, ordersApprovalCount - seenOrdersCount);

  const sidebarLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Orders', href: '/admin/orders', icon: <Receipt size={16} />, badge: unreadOrdersCount },
    { name: 'Inventory', href: '/admin/inventory', icon: <Warehouse size={16} /> },
    { name: 'Analytics', href: '/admin/analytics', icon: <LineChart size={16} /> },
    { name: 'Item Assets', href: '/admin/items', icon: <Box size={16} />, badge: pendingCount },
    { name: 'Packages', href: '/admin/packages', icon: <Grid3X3 size={16} /> },
    { name: 'Inquiries', href: '/admin/inquiries', icon: <MessageSquare size={16} />, badge: pendingInquiriesCount },
    { name: 'Settings', href: '/admin/settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <AdminGuard>
      <div className="flex h-screen bg-[#F9F9F7] text-[#1A1A1A] font-sans overflow-hidden selection:bg-[#D4C5B9] selection:text-[#1A1A1A]">
        
        {/* 1. Admin Sidebar (Matte Off-Black) */}
        <aside className="hidden md:flex flex-col w-64 bg-[#1A1A1A] text-white border-r border-gray-800 shrink-0">
          
          {/* Logo Branding */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-850">
            {/* Minimalist Ceramic Tile Icon in white/sand */}
            <div className="w-8 h-8 border-2 border-[#D4C5B9] flex items-center justify-center p-1 relative overflow-hidden">
              <div className="w-full h-full border border-dashed border-[#D4C5B9]/60 flex items-center justify-center">
                <span className="text-[9px] font-bold text-[#D4C5B9]">A</span>
              </div>
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#D4C5B9]"></div>
            </div>
            
            <div className="flex flex-col">
              <span className="font-extrabold text-[12px] tracking-[0.15em] text-white leading-none uppercase">
                Alahapperuma
              </span>
              <span className="font-normal text-[8px] tracking-[0.25em] text-[#D4C5B9] uppercase mt-0.5 leading-none">
                Showroom OS
              </span>
            </div>
          </div>

          {/* Links View */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {sidebarLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold tracking-widest uppercase transition-all duration-300 relative ${
                    active
                      ? 'bg-[#D4C5B9] text-[#1A1A1A]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.icon}
                  <span>{link.name}</span>
                  {'badge' in link && typeof link.badge === 'number' && link.badge > 0 && (
                    <span className={`
                      ml-auto min-w-[20px] h-5 flex items-center justify-center
                      text-[10px] font-bold rounded-full px-1.5
                      ${active ? 'bg-amber-500 text-white' : 'bg-amber-500 text-white'}
                      ${showNewItemPulse ? 'animate-pulse' : ''}
                    `}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout controls & user profile */}
          <div className="p-4 border-t border-gray-850 space-y-4">
            {/* User Profile Block */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/5 rounded-none">
              <div className="w-8 h-8 rounded-full bg-[#D4C5B9]/15 border border-[#D4C5B9]/20 flex items-center justify-center text-[#D4C5B9]">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white leading-none">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[8px] text-[#D4C5B9] font-bold uppercase tracking-widest mt-1.5 leading-none">
                  {user?.role} Access
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 text-xs font-semibold tracking-widest uppercase text-red-400 hover:bg-red-500/5 transition-colors"
            >
              <LogOut size={16} />
              <span>Logout Session</span>
            </button>
          </div>
        </aside>

        {/* 2. Main content viewport */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top Admin Header Bar */}
          <header className="h-14 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0 font-sans">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
                Alahapperuma Trade Center
              </span>
              <span className="text-[10px] text-gray-400 font-light border-l border-gray-200 pl-3">
                Showroom OS Management Dashboard
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Notification Bell Icon with Badge */}
              <div
                className="relative py-2 -my-2 admin-notification-container"
                onMouseEnter={() => setShowNotificationDropdown(true)}
                onMouseLeave={() => setShowNotificationDropdown(false)}
              >
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="p-2 text-gray-700 hover:text-[#1A1A1A] hover:bg-gray-100 transition-colors relative block rounded-full"
                  aria-label="Admin Notifications"
                >
                  <Bell size={18} strokeWidth={1.8} />
                  {unreadAdminCount > 0 && (
                    <span className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none animate-pulse">
                      {unreadAdminCount > 9 ? '9+' : unreadAdminCount}
                    </span>
                  )}
                </button>

                {/* Notifications Popover Dropdown */}
                {showNotificationDropdown && (
                  <div
                    className="absolute right-0 top-full pt-1 w-80 z-50"
                    onMouseEnter={() => setShowNotificationDropdown(true)}
                    onMouseLeave={() => setShowNotificationDropdown(false)}
                  >
                    <div className="bg-white border border-gray-200 shadow-xl text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-3.5 bg-[#F9F9F7] border-b border-gray-200 flex justify-between items-center">
                        <span className="font-bold text-[#1A1A1A] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                          <Bell size={12} className="text-[#8C7A6B]" />
                          <span>Admin Notifications</span>
                        </span>
                        {unreadAdminCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[9px] text-[#8C7A6B] hover:text-black font-semibold uppercase tracking-wider"
                          >
                            Mark All Read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                        {adminNotifications.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-[11px] font-light">
                            No notifications found.
                          </div>
                        ) : (
                          adminNotifications.map((n) => (
                            <div
                              key={n.notification_id}
                              onClick={() => handleMarkOneRead(n.notification_id)}
                              className={`p-3.5 hover:bg-[#F9F9F7] transition-colors cursor-pointer ${
                                !n.is_read ? 'bg-amber-50/40 border-l-2 border-l-amber-500' : ''
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className={`font-semibold text-[11px] ${!n.is_read ? 'text-amber-950 font-bold' : 'text-[#1A1A1A]'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[8.5px] text-gray-400 font-mono">
                                  {new Date(n.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-gray-600 font-light mt-1 leading-snug">
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
                        <Link
                          href="/admin/notifications"
                          onClick={() => setShowNotificationDropdown(false)}
                          className="text-[10px] font-bold text-[#8C7A6B] hover:text-black uppercase tracking-wider block py-1"
                        >
                          View All Notifications →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Notification Banner — New OSPOS Items Pending Review */}
          {pendingCount > 0 && !bannerDismissed && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-4 animate-in slide-in-from-top duration-300">
              <div className="flex items-center justify-center w-8 h-8 bg-amber-100 border border-amber-200 rounded-full shrink-0">
                <PackagePlus size={15} className="text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  {pendingCount} New {pendingCount === 1 ? 'Item' : 'Items'} Pending Review
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                  {pendingItems.length > 0
                    ? pendingItems.map(i => i.name).join(', ')
                    : 'New items were added in OSPOS and need to be published to the storefront.'
                  }
                </p>
              </div>
              <Link
                href="/admin/items"
                className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                Review Items
              </Link>
              <button
                onClick={() => setBannerDismissed(true)}
                className="shrink-0 p-1.5 text-amber-400 hover:text-amber-700 transition-colors"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Viewport content */}
          <main className="flex-grow overflow-y-auto p-8 bg-[#F9F9F7]/60">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}

