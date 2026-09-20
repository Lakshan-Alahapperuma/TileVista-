'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Sparkles, ShoppingBag, Loader2, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { usePackageStore } from '../../store/package.store';
import { packageService } from '../../services/package.service';
import { useCart } from '../../features/cart/hooks/useCart';
import { useDesignerStore } from '../../store/designer.store';
import { Package } from '../../types/package';

export const PackageList: React.FC = () => {
  const { packages, isLoading, error, setPackages, setIsLoading, setError } = usePackageStore();
  const { addItem } = useCart();
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [addingPkgId, setAddingPkgId] = useState<string | null>(null);

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
    } catch (err: any) {
      useDesignerStore.getState().showAlert(`Failed to add package items to cart: ${err.message || 'Error occurred'}`);
    } finally {
      setAddingPkgId(null);
    }
  };

  const handleResetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
  };




  // Filtering logic




  const filteredPackages = packages.filter((pkg) => {
    const price = pkg.calculatedPrice || 0;
    const min = minPrice !== '' && !isNaN(Number(minPrice)) ? Number(minPrice) : 0;
    const max = maxPrice !== '' && !isNaN(Number(maxPrice)) ? Number(maxPrice) : Infinity;

    return price >= min && price <= max;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light">Loading pre-designed packages...</p>
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
    <div className="space-y-8 font-sans">
      {/* Price Range Filter Bar */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1A1A1A] text-white rounded-xl shadow-sm">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1A1A1A] tracking-wide uppercase">
                Filter Packages by Price Range
              </h3>
              <p className="text-xs text-gray-400 font-light mt-0.5">
                Set minimum and maximum price boundaries in Sri Lankan Rupees (LKR)
              </p>
            </div>
          </div>

          {(minPrice !== '' || maxPrice !== '') && (
            <button
              onClick={handleResetFilters}
              className="self-start md:self-auto px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-all flex items-center gap-1.5 border border-gray-200"
            >
              <RotateCcw size={13} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          {/* Custom Min / Max Price Inputs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Min Price Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Minimum Price (LKR)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-gray-400 pointer-events-none">
                  LKR
                </span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-40 sm:w-44 pl-12 pr-3 py-2 bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-black rounded-xl text-xs font-bold text-gray-900 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            <span className="text-gray-300 font-bold text-base hidden sm:inline-block mt-4">—</span>

            {/* Max Price Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Maximum Price (LKR)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-gray-400 pointer-events-none">
                  LKR
                </span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Any"
                  className="w-40 sm:w-44 pl-12 pr-3 py-2 bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-black rounded-xl text-xs font-bold text-gray-900 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="pt-2 flex items-center justify-between text-xs text-gray-500 font-medium">
          <span>
            Showing <strong className="text-black">{filteredPackages.length}</strong> of{' '}
            <strong className="text-black">{packages.length}</strong> available packages
          </span>
          {(minPrice || maxPrice) && (
            <span className="text-[11px] text-[#D4C5B9] font-semibold">
              Filter Active: {minPrice ? `Min LKR ${Number(minPrice).toLocaleString()}` : 'No Min'} to{' '}
              {maxPrice ? `Max LKR ${Number(maxPrice).toLocaleString()}` : 'No Max'}
            </span>
          )}
        </div>
      </div>

      {/* Package Grid or Empty State */}
      {filteredPackages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xl">
            🏷️
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              No packages match your price criteria
            </h4>
            <p className="text-xs text-gray-500 font-light max-w-sm">
              Try adjusting your minimum or maximum price range to view available bathroom packages.
            </p>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-[#1A1A1A] text-white hover:bg-black text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm"
          >
            Clear Price Filters
          </button>
        </div>
      ) : (




        /* package details  */


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPackages.map((pkg) => {
            return (
              <div
                key={pkg.id}
                className="flex flex-col bg-white border border-gray-150 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-300 relative group rounded-xl overflow-hidden"
              >
                <div className="relative w-full h-[200px] bg-gray-50 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.03]"
                    style={{
                      backgroundImage: `url('${pkg.imageUrl
                          ? pkg.imageUrl.startsWith('/uploads')
                            ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}${pkg.imageUrl}`
                            : pkg.imageUrl
                          : '/images/packages/essential-comfort-package.jpeg'
                        }')`,
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
                    <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase block mb-2">
                      Included Elements
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(pkg.items || []).slice(0, 3).map((pi, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-sm"
                        >
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
                    <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase leading-none mb-1 block">
                      Bundle Price
                    </span>
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
                      onClick={() => handleAddPackageToCart(pkg)}
                      disabled={addingPkgId === pkg.id}
                      className="w-full border border-gray-300 hover:border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase py-3 transition-all duration-300 flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"
                    >
                      {addingPkgId === pkg.id ? <Loader2 size={12} className="animate-spin" /> : <ShoppingBag size={12} />}
                      <span>{addingPkgId === pkg.id ? 'Adding to Cart...' : 'Add to Cart'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PackageList;
