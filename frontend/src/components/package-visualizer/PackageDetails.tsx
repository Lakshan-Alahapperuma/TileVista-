'use client';

import React from 'react';
import { Package } from '../../types/package';
import { Sparkles, ShoppingBag, Percent } from 'lucide-react';

interface PackageDetailsProps {
  pkg: Package;
}

export const PackageDetails: React.FC<PackageDetailsProps> = ({ pkg }) => {
  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  const handleAddPackageToCart = () => {
    alert(`Successfully added curated package bundle "${pkg.name}" to your shopping cart!`);
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden font-sans p-6 md:p-8 space-y-6">
      {/* Banner / Cover */}
      <div 
        className="w-full h-[240px] bg-cover bg-center rounded-lg shadow-sm relative overflow-hidden"
        style={{ 
          backgroundImage: `url('${
            pkg.imageUrl
              ? (pkg.imageUrl.startsWith('/uploads')
                  ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}${pkg.imageUrl}`
                  : pkg.imageUrl)
              : '/images/packages/essential-comfort-package.jpeg'
          }')` 
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-6 left-6 text-white space-y-1">
          <div className="inline-flex items-center gap-1 bg-[#D4C5B9] text-[#1A1A1A] font-bold text-[8px] uppercase tracking-widest px-2.5 py-0.5 rounded-sm">
            <Sparkles size={8} />
            <span>Pre-Selected Suite</span>
          </div>
          <h2 className="text-2xl font-bold tracking-wide">{pkg.name}</h2>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase mb-2">Suite Description</h4>
        <p className="text-sm text-gray-500 font-light leading-relaxed">
          {pkg.description || 'No description provided for this curated bathroom suite package.'}
        </p>
      </div>

      {/* Pricing and savings details */}
      <div className="bg-gray-50/50 border border-gray-150 rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase block mb-1">Total Bundle Price</span>
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-bold text-red-600 font-mono">
              {formatLKR(pkg.calculatedPrice)}
            </span>
            {pkg.discountPercent > 0 && (
              <span className="text-sm text-gray-400 line-through font-mono">
                {formatLKR(pkg.originalPrice)}
              </span>
            )}
          </div>
        </div>

        {pkg.discountPercent > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-2 rounded-md">
            <Percent size={15} className="shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">Save {pkg.discountPercent}%</span>
              <span className="text-[9px] text-emerald-600 font-light block leading-none mt-0.5">Special bundle discount applied</span>
            </div>
          </div>
        )}
      </div>

      {/* Action CTA */}
      <button 
        onClick={handleAddPackageToCart}
        className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-4 transition-all duration-300 flex items-center justify-center gap-2 rounded-md shadow-sm"
      >
        <ShoppingBag size={14} />
        <span>Add Curated Suite to Cart</span>
      </button>
    </div>
  );
};

export default PackageDetails;
