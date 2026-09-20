'use client';

import React from 'react';
import { Package } from '../../types/package';
import { getBrand } from '../../features/products/utils';

interface PackageProductListProps {
  pkg: Package;
}

export const PackageProductList: React.FC<PackageProductListProps> = ({ pkg }) => {
  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  const isTileItem = (item: any) => {
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    return cat.includes('tile') || cat.includes('mosaic') || name.includes('tile') || type.includes('tile');
  };

  // Exclude tiles since packages do not include tiles
  const nonTileItems = (pkg.items || []).filter(item => !isTileItem(item));

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden font-sans p-6 md:p-8 space-y-4">
      <div>
        <h4 className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block mb-1">Included Showroom Products</h4>
        <p className="text-xs text-gray-400 font-light">List of all items combined in this package suite.</p>
      </div>

      <div className="divide-y divide-gray-150 border border-gray-150 rounded-xl overflow-hidden">
        {nonTileItems.length === 0 ? (
          <div className="p-4 text-xs text-gray-400 text-center">No products included in this package.</div>
        ) : (
          nonTileItems.map((item, idx) => {
            const brand = getBrand(item);
            return (
              <div key={idx} className="p-4 flex items-center justify-between gap-3 bg-white hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  {item.imageUrl ? (
                    <div 
                      className="w-12 h-12 bg-cover bg-center rounded-lg border border-gray-150 shrink-0 shadow-sm" 
                      style={{ backgroundImage: `url('${item.imageUrl}')` }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 font-bold shrink-0 text-sm">
                      📦
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[9px] font-extrabold text-[#B8A390] uppercase tracking-wider block mb-0.5">
                      {brand}
                    </span>
                    <h5 className="font-bold text-xs text-gray-900 truncate">{item.name}</h5>
                    <span className="text-[10px] text-gray-400 font-mono block mt-0.5">SKU: {item.sku || 'N/A'}</span>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border border-gray-200/60">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-extrabold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 font-mono">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Item Price</span>
                  <span className="font-mono font-bold text-xs text-gray-900 block">
                    {formatLKR(item.price * item.quantity)}
                  </span>
                  {item.quantity > 1 && (
                    <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                      ({formatLKR(item.price)} each)
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PackageProductList;
