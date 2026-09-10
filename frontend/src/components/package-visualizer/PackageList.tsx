'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Compass, Sparkles, ShoppingBag, Loader2 } from 'lucide-react';
import { usePackageStore } from '../../store/package.store';
import { packageService } from '../../services/package.service';

export const PackageList: React.FC = () => {
  const { packages, isLoading, error, setPackages, setIsLoading, setError } = usePackageStore();

  useEffect(() => {
    const loadPackages = async () => {
      setIsLoading(true);
      try {
        const pkgs = await packageService.getPackages(false);
        setPackages(pkgs);
      } catch (err: any) {
        setError(err.message || 'Failed to load packages');
      } finally {
        setIsLoading(false);
      }
    };
    loadPackages();
  }, [setPackages, setIsLoading, setError]);

  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  const handleAddPackageToCart = (pName: string) => {
    alert(`Successfully added curated package bundle "${pName}" to your shopping cart!`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light font-sans">Loading pre-designed packages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center max-w-md mx-auto space-y-4 font-sans">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-lg">
          ⚠️
        </div>
        <h4 className="text-sm font-semibold text-[#1A1A1A]">Unable to load packages</h4>
        <p className="text-xs text-gray-400 leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 font-sans">
      {packages.map((pkg) => {
        return (
          <div 
            key={pkg.id} 
            className="flex flex-col bg-white border border-gray-150 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-300 relative group rounded-xl overflow-hidden"
          >
            <div className="relative w-full h-[200px] bg-gray-50 overflow-hidden">
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.03]"
                style={{ 
                  backgroundImage: `url('${
                    pkg.imageUrl
                      ? (pkg.imageUrl.startsWith('/uploads')
                          ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}${pkg.imageUrl}`
                          : pkg.imageUrl)
                      : '/images/packages/essential-comfort-package.jpeg'
                  }')` 
                }}
              />
              <div className="absolute top-4 left-4 z-10 bg-[#1A1A1A] text-[#D4C5B9] font-bold text-[8px] uppercase tracking-widest px-2.5 py-1 flex items-center gap-1 shadow-sm rounded-sm">
                <Sparkles size={9} />
                <span>{pkg.discountPercent > 12 ? 'Premium Suite' : 'Comfort Suite'}</span>
              </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
              <h3 className="text-lg font-semibold text-[#1A1A1A] tracking-wide mb-2 group-hover:text-[#D4C5B9] transition-colors">
                {pkg.name}
              </h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed mb-4 line-clamp-2">
                {pkg.description}
              </p>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase block mb-2">Included Elements</span>
                <div className="flex flex-wrap gap-1">
                  {(pkg.items || []).slice(0, 3).map((pi, idx) => (
                    <span key={idx} className="text-[9px] bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-sm">
                      {pi.name} {pi.quantity > 1 ? `x${pi.quantity}` : ''}
                    </span>
                  ))}
                  {(pkg.items || []).length > 3 && (
                    <span className="text-[9px] text-[#D4C5B9] font-semibold self-center ml-1">
                      +{(pkg.items || []).length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-6 mt-auto">
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase leading-none mb-1 block">Bundle Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-red-600">
                    {formatLKR(pkg.calculatedPrice)}
                  </span>
                  {pkg.discountPercent > 0 && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatLKR(pkg.originalPrice)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Link 
                  href={`/packages/${pkg.id}`}
                  className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase py-3 transition-all duration-300 flex items-center justify-center gap-2 rounded-sm"
                >
                  <Compass size={13} />
                  <span>View Details & 3D</span>
                </Link>
                <button 
                  onClick={() => handleAddPackageToCart(pkg.name)}
                  className="w-full border border-gray-300 hover:border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase py-3 transition-all duration-300 flex items-center justify-center gap-2 rounded-sm"
                >
                  <ShoppingBag size={12} />
                  <span>Add Package to Cart</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PackageList;
