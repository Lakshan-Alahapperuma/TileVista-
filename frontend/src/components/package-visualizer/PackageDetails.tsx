'use client';

import React, { useState } from 'react';
import { Package } from '../../types/package';
import { Sparkles, ShoppingBag, Percent, Loader2 } from 'lucide-react';
import { useCart } from '../../features/cart/hooks/useCart';
import { useDesignerStore } from '../../store/designer.store';

interface PackageDetailsProps {
  pkg: Package;
}

export const PackageDetails: React.FC<PackageDetailsProps> = ({ pkg }) => {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  const handleAddPackageToCart = async () => {
    if (isAdding) return;
    setIsAdding(true);
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
          useDesignerStore.getState().showAlert(`Successfully added all items from "${pkg.name}" to your shopping cart!`);
        } else {
          useDesignerStore.getState().showAlert(`No valid items found in package "${pkg.name}".`);
        }
      } else {
        useDesignerStore.getState().showAlert(`No items in package "${pkg.name}".`);
      }
    } catch (err: any) {
      useDesignerStore.getState().showAlert(`Failed to add package items to cart: ${err.message || 'Error occurred'}`);
    } finally {
      setIsAdding(false);
    }
  };

  const isTileItem = (item: any) => {
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    return cat.includes('tile') || cat.includes('mosaic') || name.includes('tile') || type.includes('tile');
  };

  const nonTileItems = (pkg.items || []).filter(item => !isTileItem(item));

  let origPrice = 0;
  if (nonTileItems.length > 0) {
    origPrice = nonTileItems.reduce((sum: number, i: any) => sum + (Number(i.price || 0) * (i.quantity || 1)), 0);
  } else if (pkg.originalPrice && pkg.originalPrice > 0) {
    origPrice = pkg.originalPrice;
  } else if (pkg.designData && Array.isArray(pkg.designData.placedItems)) {
    origPrice = pkg.designData.placedItems.reduce((sum: number, i: any) => sum + Number(i.cost || i.price || 150), 0);
  }

  const discountPercent = pkg.discountPercent || 0;
  const calcPrice = pkg.calculatedPrice > 0 ? pkg.calculatedPrice : (origPrice * (1 - discountPercent / 100));

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
              {formatLKR(calcPrice)}
            </span>
            {discountPercent > 0 && (
              <span className="text-sm text-gray-400 line-through font-mono">
                {formatLKR(origPrice)}
              </span>
            )}
          </div>
        </div>

        {discountPercent > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-2 rounded-md">
            <Percent size={15} className="shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">Save {discountPercent}%</span>
              <span className="text-[9px] text-emerald-600 font-light block leading-none mt-0.5">Special bundle discount applied</span>
            </div>
          </div>
        )}
      </div>

      {/* Action CTA */}
      <button 
        onClick={handleAddPackageToCart}
        disabled={isAdding}
        className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] disabled:bg-gray-400 text-white font-bold text-xs tracking-widest uppercase py-4 transition-all duration-300 flex items-center justify-center gap-2 rounded-md shadow-sm active:scale-98"
      >
        {isAdding ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
        <span>{isAdding ? 'Adding to Cart...' : 'Add to Cart'}</span>
      </button>
    </div>
  );
};

export default PackageDetails;
