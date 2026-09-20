'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1A1A1A] text-white pt-16 pb-8 border-t border-gray-800 font-sans mt-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        {/* Row 1: Brand & Horizontal Nav Links */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-10 border-b border-gray-800/80 gap-8">
          
          {/* Brand Logo Group wrapped in standard Link */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 relative overflow-hidden flex-shrink-0">
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
            <Link href="/products" className="hover:text-white transition-colors">Shop</Link>
            <Link href="/packages" className="hover:text-white transition-colors">Packages</Link>
            <Link href="/designer" className="hover:text-white transition-colors">3D Designer</Link>
            <Link href="/cart" className="hover:text-white transition-colors">Cart</Link>
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
  );
};
