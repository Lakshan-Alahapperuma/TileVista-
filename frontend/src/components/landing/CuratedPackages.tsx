'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles, Loader2, Compass, ShoppingBag } from 'lucide-react';
import { packageService } from '../../services/package.service';
import { Package } from '../../types/package';
import { useCart } from '../../features/cart/hooks/useCart';
import { useDesignerStore } from '../../store/designer.store';

interface CuratedPackagesProps {
  onVisualizePackage: (packageId: string) => void;
  onAddToCart?: (packageId: string) => void;
}

export const CuratedPackages: React.FC<CuratedPackagesProps> = ({ onVisualizePackage, onAddToCart }) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addingPkgId, setAddingPkgId] = useState<string | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchLatestPackages = async () => {
      setIsLoading(true);
      try {
        const allPkgs = await packageService.getPackages(false);
        // Take latest 3 packages
        setPackages(allPkgs.slice(0, 3));
      } catch (err: any) {
        console.error('Failed to load curated packages:', err);
        setError(err.message || 'Failed to load packages');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatestPackages();
  }, []);

  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  const handleAddPackageToCart = async (pkg: Package) => {
    if (addingPkgId) return;
    setAddingPkgId(pkg.id);
    try {
      if (pkg.items && pkg.items.length > 0) {
        let addedCount = 0;
        for (const item of pkg.items) {
          const itemId = item.osposItemId || (item as any).itemId || (item as any).id;
          if (itemId) {
            await addItem(Number(itemId), item.quantity || 1);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          useDesignerStore.getState().showAlert(`Successfully added all items from "${pkg.name}" package to your shopping cart!`);
        } else {
          useDesignerStore.getState().showAlert(`No valid items found in package "${pkg.name}".`);
        }
      } else {
        useDesignerStore.getState().showAlert(`No items in package "${pkg.name}".`);
      }
      if (onAddToCart) {
        onAddToCart(pkg.id);
      }
    } catch (err: any) {
      useDesignerStore.getState().showAlert(`Failed to add package items to cart: ${err.message || 'Error occurred'}`);
    } finally {
      setAddingPkgId(null);
    }
  };

  const getImageUrl = (url?: string | null) => {
    if (!url) return '/images/packages/essential-comfort-package.jpeg';
    if (url.startsWith('/uploads')) {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
      return `${backendUrl}${url}`;
    }
    return url;
  };

  const getRangeBadge = (discountPercent: number, calculatedPrice: number) => {
    if (discountPercent > 12 || calculatedPrice > 700000) return 'Premium Range';
    if (discountPercent > 8 || calculatedPrice > 450000) return 'Medium Range';
    return 'Budget Range';
  };

  return (
    <section className="bg-white py-16 md:py-24 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 md:px-12 font-sans">
        
        {/* Header Title with View All Link */}
        <div className="flex items-end justify-between mb-12">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase mb-2 block">
              PRE-DESIGNED SUITES
            </span>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1A1A]">
              Curated Bathroom Packages
            </h2>
          </div>
          
          <Link 
            href="/packages"
            className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-[#1A1A1A] uppercase border-b border-[#1A1A1A] pb-0.5 hover:opacity-75 transition-all"
          >
            <span>VIEW ALL</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="animate-pulse bg-gray-50 border border-gray-100 rounded-sm p-6 space-y-4 h-[480px]">
                <div className="w-full h-[260px] bg-gray-200 rounded" />
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-lg p-6 text-center text-xs">
            ⚠️ Failed to load curated packages. Please ensure the backend server is running.
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && packages.length === 0 && (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-500 text-xs">
            No packages available at the moment. Admin can create suite packages to display here.
          </div>
        )}

        {/* 3-Column Package Layout */}
        {!isLoading && !error && packages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {packages.map((pkg) => (
              <div 
                key={pkg.id} 
                className="flex flex-col bg-white border border-gray-100 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                {/* Product Setup Image Banner */}
                <div className="relative w-full h-[260px] md:h-[320px] bg-gray-100 overflow-hidden group">
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url('${getImageUrl(pkg.imageUrl)}')` }}
                  />
                  
                  {/* Accent Tag */}
                  <div className="absolute top-4 left-4 z-10 bg-[#1A1A1A] text-[#D4C5B9] font-semibold text-[9px] uppercase tracking-widest px-3 py-1.5 flex items-center gap-1.5">
                    <Sparkles size={10} />
                    <span>{getRangeBadge(pkg.discountPercent, pkg.calculatedPrice)}</span>
                  </div>
                </div>

                {/* Package Details */}
                <div className="p-6 md:p-8 flex flex-col flex-1">
                  <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-wide mb-3 line-clamp-1">
                    {pkg.name}
                  </h3>
                  
                  <p className="text-xs md:text-sm text-gray-500 font-light leading-relaxed tracking-wide mb-4 line-clamp-2">
                    {pkg.description || 'Pre-designed bathroom layout curated by TileVista experts.'}
                  </p>
                  
                  <div className="mb-6 flex-1">
                    <h4 className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase mb-2">Included Elements</h4>
                    {pkg.items && pkg.items.length > 0 ? (
                      <ul className="text-xs text-gray-500 font-light leading-relaxed tracking-wide list-disc pl-4 space-y-1">
                        {pkg.items.slice(0, 5).map((item, index) => (
                          <li key={index}>
                            {item.name} {item.quantity > 1 ? `(${item.quantity} units)` : ''}
                          </li>
                        ))}
                        {pkg.items.length > 5 && (
                          <li className="list-none text-[10px] text-[#D4C5B9] font-semibold pt-1">
                            + {pkg.items.length - 5} more items included
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Full 3D layout suite setup included</p>
                    )}
                  </div>

                  {/* Pricing section */}
                  <div className="border-t border-gray-100 pt-6 mb-6 flex flex-col items-start gap-1 mt-auto">
                    <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase">Bundle Price</span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl md:text-2xl font-bold text-red-600">
                        {formatLKR(pkg.calculatedPrice)}
                      </span>
                      {pkg.discountPercent > 0 && (
                        <span className="text-xs md:text-sm text-gray-400 line-through">
                          {formatLKR(pkg.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => onVisualizePackage(pkg.id)}
                      className="w-full bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white font-semibold text-xs tracking-wider uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Compass size={14} />
                      <span>Visualize in 3D Canvas</span>
                    </button>
                    <button 
                      onClick={() => handleAddPackageToCart(pkg)}
                      disabled={addingPkgId === pkg.id}
                      className="w-full border border-gray-300 hover:border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {addingPkgId === pkg.id ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
                      <span>{addingPkgId === pkg.id ? 'Adding to Cart...' : 'Add to Cart'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
