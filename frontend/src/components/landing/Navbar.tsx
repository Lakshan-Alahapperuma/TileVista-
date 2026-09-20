'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Phone, MapPin } from 'lucide-react';
import { MegaMenuDropdown } from '../shared/MegaMenuDropdown';

interface NavbarProps {
  cartCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount }) => {
  return (
    <>
      {/* 1. Top Contact Bar (Static, matched to other pages) */}
      <div className="w-full bg-[#1A1A1A] border-b border-gray-800 py-2.5 px-6 md:px-12 flex items-center justify-center gap-6 text-[10.5px] text-gray-300 tracking-wide font-light flex-wrap font-sans">
        <span className="flex items-center gap-1.5">
          <Phone size={11} className="text-[#D4C5B9]" />
          <a href="tel:+94770834361" className="hover:text-white transition-colors">+94 77 083 4361</a>
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={11} className="text-[#D4C5B9]" />
          <span>Pannagamuwa, Weerawila, Hambantota, Sri Lanka</span>
        </span>
      </div>

      {/* 2. Main Sticky Navbar — direct sibling of top bar so sticky applies to full-page scroll */}
      <header className="w-full bg-white/60 backdrop-blur-xl shadow-sm border-b border-white/20 py-3.5 px-6 md:px-12 sticky top-0 z-50 transition-all duration-300 font-sans">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">

          {/* Left: Brand Logotype */}
          <Link
            href="/"
            className="flex items-center gap-3 group"
            id="logo-brand"
          >
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

          {/* Center: Hyperlinked Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            <Link
              href="/"
              className="text-xs font-semibold tracking-widest text-[#1A1A1A] uppercase border-b border-[#1A1A1A] pb-1 hover:opacity-80 transition"
            >
              Home
            </Link>
            <div className="group relative py-6 -my-6">
              <button
                className="flex items-center gap-1 text-xs font-semibold tracking-widest text-gray-500 uppercase pb-1 group-hover:text-[#1A1A1A] group-hover:border-b group-hover:border-gray-300 transition-all cursor-default"
              >
                Shop
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="m6 9 6 6 6-6" /></svg>
              </button>

              {/* Mega Menu Dropdown */}
              <MegaMenuDropdown />
            </div>
            <Link
              href="/packages"
              className="text-xs font-semibold tracking-widest text-gray-500 uppercase pb-1 hover:text-[#1A1A1A] hover:border-b hover:border-gray-300 transition"
            >
              Packages
            </Link>
            <Link
              href="/designer"
              className="text-xs font-semibold tracking-widest text-gray-500 uppercase pb-1 hover:text-[#1A1A1A] hover:border-b hover:border-gray-300 transition"
            >
              3D Designer
            </Link>
            <Link
              href="/contact"
              className="text-xs font-semibold tracking-widest text-gray-500 uppercase pb-1 hover:text-[#1A1A1A] hover:border-b hover:border-gray-300 transition"
            >
              Contact
            </Link>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-5">
            {/* Cart Icon with badge */}
            <Link
              href="/cart"
              className="text-gray-700 hover:text-[#1A1A1A] p-1.5 transition-colors relative flex items-center"
              aria-label="Shopping Cart"
            >
              <ShoppingCart size={20} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-0.5 bg-[#D4C5B9] text-white text-[8px] font-bold rounded-[6px] w-[10px] h-[17px] flex items-center justify-center leading-none">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User profile dot */}
            <Link
              href="/login"
              className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 border border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors overflow-hidden"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-gray-400"></div>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
};
