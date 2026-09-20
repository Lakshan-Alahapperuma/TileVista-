'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, RefreshCw, Phone, Mail, MapPin, User, Bell, Check, ChevronDown, Calendar, Package, Menu, X } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { MegaMenuDropdown } from '../../components/shared/MegaMenuDropdown';
import { useCart } from '../../features/cart/hooks/useCart';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { items } = useCart();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState<number>(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = React.useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const fetchNotifications = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      if (!token) return;

      const [listRes, countRes] = await Promise.all([
        fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setNotifications(Array.isArray(listData) ? listData.slice(0, 5) : []);
      }
      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadNotificationCount(countData.unreadCount || 0);
      }
    } catch {
      // Silently fail navigation notifications poll
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-dropdown-container') && !target.closest('.account-dropdown-container')) {
        setShowNotificationDropdown(false);
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      if (!token) return;
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch {
      // Silently handle error
    }
  };

  const handleMarkOneRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      if (!token) return;
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch {
      // Silently handle error
    }
  };

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Shop', href: '/products' },
    { name: 'Packages', href: '/packages' },
    { name: '3D Designer', href: '/designer' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#1A1A1A] font-sans selection:bg-[#D4C5B9] selection:text-[#1A1A1A]">

      {/* 1. Top Contact Bar */}
      <div className="w-full bg-[#1A1A1A] border-b border-gray-800 py-2.5 px-6 md:px-12 flex items-center justify-center gap-6 text-[10.5px] text-gray-300 tracking-wide font-light flex-wrap">
        <span className="flex items-center gap-1.5">
          <Phone size={11} className="text-[#D4C5B9]" />
          <a href="tel:+94770834361" className="hover:text-white transition-colors">+94 77 083 4361</a>
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={11} className="text-[#D4C5B9]" />
          <span>Pannagamuwa, Weerawila, Hambantota, Sri Lanka</span>
        </span>
      </div>

      {/* 2. Main Navigation Bar */}
      <header className="w-full bg-white/60 backdrop-blur-xl shadow-sm border-b border-white/20 py-3.5 px-6 md:px-12 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Left: Brand Logotype */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 relative overflow-hidden flex-shrink-0">
              <img src="/images/ui/logo.svg" alt="Alahapperuma Trade Center Logo" className="w-full h-full object-contain" />
            </div>

            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] md:text-[17px] tracking-[0.15em] text-[#1A1A1A] leading-none uppercase">
                Alahapperuma
              </span>
              <span className="font-normal text-[9px] tracking-[0.35em] text-gray-500 uppercase mt-0.5 leading-none">
                Trade Center
              </span>
            </div>
          </Link>

          {/* Center: Links */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {navigation.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              if (item.name === 'Shop') {
                return (
                  <div key={item.href} className="group relative py-6 -my-6">
                    <button
                      className={`flex items-center gap-1 text-xs font-semibold tracking-widest uppercase pb-1 transition-all cursor-default ${active
                        ? 'text-[#1A1A1A] border-b border-[#1A1A1A]'
                        : 'text-gray-500 group-hover:text-[#1A1A1A] group-hover:border-b group-hover:border-gray-300'
                        }`}
                    >
                      {item.name}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="m6 9 6 6 6-6" /></svg>
                    </button>

                    {/* Mega Menu Dropdown */}
                    <MegaMenuDropdown />
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xs font-semibold tracking-widest uppercase pb-1 transition-all ${active
                    ? 'text-[#1A1A1A] border-b border-[#1A1A1A]'
                    : 'text-gray-500 hover:text-[#1A1A1A] hover:border-b hover:border-gray-300'
                    }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-5">
            {/* Cart Icon with badge */}
            <Link
              href="/cart"
              className="text-gray-700 hover:text-[#1A1A1A] p-1.5 transition-colors relative"
              aria-label="Shopping Cart"
            >
              <ShoppingCart size={20} strokeWidth={1.8} />
              {items.length > 0 && (
                <span className="absolute -top-1.5 -right-0.5 bg-[#D4C5B9] text-white text-[8px] font-bold rounded-[6px] w-[14px] h-[14px] flex items-center justify-center leading-none">
                  {items.length}
                </span>
              )}
            </Link>

            {/* Notification Bell & User Account Menu */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* 1. Notification Bell Icon with Badge (Hover + Click trigger) */}
                <div
                  className="relative py-2 -my-2 notification-dropdown-container"
                  onMouseEnter={() => {
                    setShowNotificationDropdown(true);
                    setShowAccountDropdown(false);
                  }}
                  onMouseLeave={() => setShowNotificationDropdown(false)}
                >
                  <button
                    onClick={() => {
                      setShowNotificationDropdown(!showNotificationDropdown);
                      setShowAccountDropdown(false);
                    }}
                    className="p-1.5 text-gray-700 hover:text-[#1A1A1A] transition-colors relative block"
                    aria-label="Notifications"
                  >
                    <Bell size={19} strokeWidth={1.8} />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none animate-pulse">
                        {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
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
                            <span>Notifications</span>
                          </span>
                          {unreadNotificationCount > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-[9px] text-[#8C7A6B] hover:text-black font-semibold uppercase tracking-wider"
                            >
                              Mark All Read
                            </button>
                          )}
                        </div>

                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-[11px] font-light">
                              No notifications yet.
                            </div>
                          ) : (
                            notifications.map((n) => (
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
                            href="/notifications"
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

                {/* 2. Customer MY ACCOUNT Dropdown Menu (Hover + Click trigger) */}
                <div
                  className="relative py-2 -my-2 account-dropdown-container"
                  onMouseEnter={() => {
                    setShowAccountDropdown(true);
                    setShowNotificationDropdown(false);
                  }}
                  onMouseLeave={() => setShowAccountDropdown(false)}
                >
                  <button
                    onClick={() => {
                      setShowAccountDropdown(!showAccountDropdown);
                      setShowNotificationDropdown(false);
                    }}
                    className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-wider text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white uppercase border border-[#1A1A1A] px-3 py-1.5 transition-all bg-white"
                  >
                    <span>MY ACCOUNT</span>
                    <ChevronDown size={12} />
                  </button>

                  {showAccountDropdown && (
                    <div
                      className="absolute right-0 top-full pt-1 w-48 z-50"
                      onMouseEnter={() => setShowAccountDropdown(true)}
                      onMouseLeave={() => setShowAccountDropdown(false)}
                    >
                      <div className="bg-white border border-gray-200 shadow-xl py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-4 py-2 border-b border-gray-100 bg-[#F9F9F7]">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Logged In As</span>
                          <span className="font-semibold text-[#1A1A1A] block truncate">{user.firstName || user.email}</span>
                        </div>

                        <Link
                          href="/dashboard"
                          onClick={() => setShowAccountDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-[#F9F9F7] hover:text-black font-medium transition-colors"
                        >
                          <Package size={13} className="text-[#8C7A6B]" />
                          <span>My Orders</span>
                        </Link>

                        <Link
                          href="/notifications"
                          onClick={() => setShowAccountDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-[#F9F9F7] hover:text-black font-medium transition-colors"
                        >
                          <Bell size={13} className="text-[#8C7A6B]" />
                          <span>Notifications ({unreadNotificationCount})</span>
                        </Link>

                        <Link
                          href="/account"
                          onClick={() => setShowAccountDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-[#F9F9F7] hover:text-black font-medium transition-colors border-t border-gray-100"
                        >
                          <User size={13} className="text-[#8C7A6B]" />
                          <span>Account Details</span>
                        </Link>

                        <button
                          onClick={() => {
                            setShowAccountDropdown(false);
                            setShowLogoutConfirm(true);
                          }}
                          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 font-bold transition-colors border-t border-gray-100 uppercase text-[9.5px] tracking-wider"
                        >
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 border border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors overflow-hidden"
                aria-label="User Profile Login"
              >
                <User size={16} className="text-gray-500" />
              </Link>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button 
              className="p-2 -mr-2 text-gray-700 hover:text-[#1A1A1A] hover:bg-gray-100 rounded-full md:hidden transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close mobile menu"
        />
      )}

      {/* Mobile Drawer (Right Side) */}
      <aside 
        className={`
          fixed inset-y-0 right-0 z-50 flex flex-col w-64 bg-white text-[#1A1A1A] shadow-2xl shrink-0 
          transition-transform duration-300 ease-in-out md:hidden
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <span className="font-bold text-[12px] tracking-[0.15em] uppercase">Navigation</span>
          <button 
            className="p-2 -mr-2 text-gray-400 hover:text-[#1A1A1A] transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 px-6 py-6 space-y-4 overflow-y-auto">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block text-xs font-semibold tracking-widest uppercase transition-all ${
                  active ? 'text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A]'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 3. Render Viewport Page Content */}
      <main className="flex-grow w-full">
        {children}
      </main>

      {/* 4. Footer */}
      <footer className="bg-[#1A1A1A] text-white pt-16 pb-8 border-t border-gray-800 font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          {/* Row 1: Brand & Horizontal Nav Links */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-10 border-b border-gray-800/80 gap-8">

            {/* Brand Logo Group */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 relative overflow-hidden flex-shrink-0 bg-white/10 p-1 rounded-sm">
                <img src="/images/ui/logo.svg" alt="Alahapperuma Trade Center Logo" className="w-full h-full object-contain" />
              </div>

              <div className="flex flex-col">
                <span className="font-bold text-[14px] tracking-[0.15em] text-white leading-none uppercase">
                  Alahapperuma
                </span>
                <span className="font-light text-[8px] tracking-[0.35em] text-[#D4C5B9] uppercase mt-0.5 leading-none">
                  Trade Center
                </span>
              </div>
            </Link>

            {/* Quicklinks Map */}
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[10.5px] font-semibold tracking-widest uppercase text-gray-400">
              <Link href="/packages" className="hover:text-white transition-colors">Packages</Link>
              <Link href="/designer" className="hover:text-white transition-colors">3D Designer</Link>
              <Link href="/cart" className="hover:text-white transition-colors">Cart</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              <span className="opacity-60 cursor-not-allowed">FAQs</span>
              <span className="opacity-60 cursor-not-allowed">Privacy</span>
            </nav>
          </div>

          {/* Row 2: Contact Info Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12 border-b border-gray-800/80 text-gray-300">

            {/* Phone */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 text-[#D4C5B9] mt-0.5">
                <Phone size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Showroom Phone</span>
                <a href="tel:+94770834361" className="text-sm font-medium tracking-wide mt-1.5 hover:text-white transition-colors">
                  +94 77 083 4361
                </a>
                <span className="text-[10px] text-gray-500 font-light mt-0.5">Available during working hours</span>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 text-[#D4C5B9] mt-0.5">
                <Mail size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Email Inquiry</span>
                <a href="mailto:info@alahapperumatrade.com" className="text-sm font-medium tracking-wide mt-1.5 hover:text-white transition-colors">
                  info@alahapperumatrade.com
                </a>
                <span className="text-[10px] text-gray-500 font-light mt-0.5">Response within 24 business hours</span>
              </div>
            </div>

            {/* Full Address */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/5 border border-white/10 text-[#D4C5B9] mt-0.5">
                <MapPin size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Postal Address</span>
                <span className="text-sm font-medium tracking-wide mt-1.5 leading-relaxed">
                  Pannagamuwa, Weerawila, <br />
                  Hambantota, Sri Lanka
                </span>
              </div>
            </div>

          </div>

          {/* Row 3: Copy copyrights & developer link */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 text-[10px] text-gray-500 tracking-wide font-light gap-4">
            <span>
              &copy; 2026 Alahapperuma Trade Center. All rights reserved.
            </span>
            <span className="flex items-center gap-1.5">
              <span>Designed & Developed by</span>
              <span className="font-semibold text-gray-400">VSD Group</span>
            </span>
          </div>

        </div>
      </footer>

      {/* Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center font-sans" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Sign Out</h3>
            <p className="text-sm text-gray-500 mb-6 font-light leading-relaxed">Are you sure you want to sign out of your account?</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowLogoutConfirm(false);
                }}
                className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
