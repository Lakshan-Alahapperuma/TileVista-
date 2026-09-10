'use client';

import React from 'react';
import { Package } from '../../types/package';
import { Check } from 'lucide-react';

interface PackageProductListProps {
  pkg: Package;
}

export const PackageProductList: React.FC<PackageProductListProps> = ({ pkg }) => {
  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden font-sans p-6 md:p-8 space-y-4">
      <div>
        <h4 className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block mb-1">Included Showroom Products</h4>
        <p className="text-xs text-gray-400 font-light">List of all items combined in this package suite.</p>
      </div>

      <div className="border border-gray-150 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              <th className="p-4">Item Details</th>
              <th className="p-4">Category</th>
              <th className="p-4 text-center">Qty</th>
              <th className="p-4 text-right">Unit Price</th>
              <th className="p-4 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 text-gray-600">
            {pkg.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <div 
                        className="w-10 h-10 bg-cover bg-center rounded border border-gray-100 shrink-0" 
                        style={{ backgroundImage: `url('${item.imageUrl}')` }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border border-gray-250 bg-gray-50 flex items-center justify-center text-gray-400 font-bold shrink-0">
                        📦
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-gray-800 block">{item.name}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">SKU: {item.sku || 'N/A'}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="bg-gray-100 border border-gray-200 text-gray-500 font-medium px-2 py-0.5 rounded-full text-[9px] uppercase">
                    {item.category}
                  </span>
                </td>
                <td className="p-4 text-center font-semibold font-mono">
                  {item.quantity}
                </td>
                <td className="p-4 text-right font-mono text-gray-700">
                  {formatLKR(item.price)}
                </td>
                <td className="p-4 text-right font-mono font-semibold text-gray-800">
                  {formatLKR(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PackageProductList;
