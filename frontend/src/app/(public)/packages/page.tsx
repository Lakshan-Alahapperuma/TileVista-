'use client';

import React from 'react';
import PackageList from '../../../components/package-visualizer/PackageList';

export default function PackagesPage() {
  return (
    <div className="py-8 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-12">
      {/* Page Header */}
      <div className="border-b border-gray-100 pb-8">
        <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase block mb-2">
          PRE-DESIGNED SUITES
        </span>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1A1A1A]">
          Curated Bathroom Packages
        </h1>
        <p className="text-sm text-gray-500 font-light mt-1.5 max-w-xl leading-relaxed">
          Stunning pre-selected layouts with bundled discount pricing. Walk inside a suite in 3D, customize elements, or checkout directly.
        </p>
      </div>

      <PackageList />
    </div>
  );
}
