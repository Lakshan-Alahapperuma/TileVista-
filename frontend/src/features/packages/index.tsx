'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowUpRight, Loader } from 'lucide-react';
import { ProductPackage } from '@tilevista/types';

export const PackagesFeature: React.FC = () => {
  const router = useRouter();
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const res = await fetch(`${apiUrl}/packages`);
        if (!res.ok) throw new Error('Failed to fetch packages');
        const data = await res.json();
        setPackages(data);
      } catch (err: any) {
        console.error('Error loading packages:', err);
        setError(err.message || 'An error occurred while loading packages.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handleLaunchCanvas = (id: string) => {
    router.push(`/designer/workspace?package=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader className="w-8 h-8 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light">Loading pre-designed packages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
          ⚠️
        </div>
        <h4 className="text-sm font-semibold text-[#1A1A1A]">Unable to load packages</h4>
        <p className="text-xs text-gray-400 leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    <div className="font-sans space-y-6">
      <div>
        <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Showroom Bundles</span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A] mt-1.5">Pre-Designed Showroom Packages</h1>
        <p className="text-xs text-gray-500 font-light mt-1">Stunning pre-selected layouts with bundled discounts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {packages.map((pkg) => (
          <div 
            key={pkg.id} 
            className="bg-white border border-gray-200 p-8 flex flex-col justify-between h-[380px] shadow-sm hover:shadow-md transition-all duration-300 relative group"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-1.5 text-[#1A1A1A] font-bold text-[9px] uppercase tracking-widest px-3 py-1 bg-[#D4C5B9]/15 border border-[#D4C5B9]/20">
                  <Sparkles size={11} className="text-[#D4C5B9]" /> 
                  <span>Curated Layout Suite</span>
                </div>
                <span className="text-emerald-700 font-bold text-[9px] uppercase tracking-widest px-2.5 py-1 bg-emerald-50 border border-emerald-100">
                  Save {pkg.discountPercent || pkg.discount_percentage}%
                </span>
              </div>

              <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-wide mb-2">
                {pkg.name}
              </h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed mb-4 line-clamp-3">
                {pkg.description}
              </p>

              {/* Items Summary list */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(pkg.items || []).slice(0, 4).map((pi: any, idx: number) => (
                  <span key={idx} className="text-[9px] bg-gray-50 text-gray-500 border border-gray-150 px-2 py-0.5 rounded-sm">
                    {pi.item?.name || 'Fixture'} (x{pi.quantity})
                  </span>
                ))}
                {(pkg.items || []).length > 4 && (
                  <span className="text-[9px] text-[#D4C5B9] font-bold self-center ml-1">
                    +{pkg.items.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-6 border-t border-gray-100 pt-6">
                <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Package Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1A1A1A] font-mono">
                    {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(pkg.calculatedPrice || pkg.price || 0)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => handleLaunchCanvas(pkg.id)}
                className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase py-3.5 transition-colors duration-300 flex items-center justify-center gap-2"
              >
                <span>Visualize In 3D Showroom</span> 
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PackagesFeature;
