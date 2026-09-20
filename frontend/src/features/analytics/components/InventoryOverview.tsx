import React from 'react';
import { formatCurrency } from '../../../utils';
import { AlertCircle, PackageX, Package, TrendingUp } from 'lucide-react';

interface InventoryOverviewProps {
  data: any;
  isLoading: boolean;
  error: string | null;
}

export const InventoryOverview: React.FC<InventoryOverviewProps> = ({ data, isLoading, error }) => {
  if (error) {
    return (
      <div className="bg-white border border-gray-200 p-8 shadow-sm flex flex-col justify-center items-center space-y-3 py-12">
        <span className="text-[#1A1A1A] text-sm font-semibold">Inventory Data Unavailable</span>
        <span className="text-gray-500 text-xs">Unable to load inventory summary.</span>
        <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 border border-gray-300 text-[10px] font-semibold tracking-widest uppercase text-gray-600 hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="bg-white border border-gray-200 p-8 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-gray-200 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 border border-gray-100 p-3 flex flex-col justify-between">
              <div className="h-2 w-16 bg-gray-200" />
              <div className="h-5 w-12 bg-gray-300" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    { label: 'Out of Stock', value: data.outOfStockItems ?? 0, icon: <PackageX size={16} className="text-[#1A1A1A]" />, alert: (data.outOfStockItems ?? 0) > 0 },
    { label: 'Below OSPOS Reorder', value: data.itemsAtOrBelowReorderLevel ?? 0, icon: <AlertCircle size={16} className="text-[#1A1A1A]" />, alert: (data.itemsAtOrBelowReorderLevel ?? 0) > 0 },
    { label: 'Total Units', value: (data.totalCurrentStock ?? 0).toLocaleString(), icon: <Package size={16} className="text-[#1A1A1A]" />, alert: false },
    { label: 'Stock Value', value: formatCurrency(data.totalStockValue ?? 0), icon: <TrendingUp size={16} className="text-[#1A1A1A]" />, alert: false },
  ];

  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">
            Inventory Status
          </h3>
          <p className="text-xs text-gray-500 font-light mt-1">Live showroom stock levels and estimated value.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`border p-4 flex flex-col justify-between ${metric.alert ? 'bg-amber-50 border-amber-200' : 'bg-[#F9F9F7] border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${metric.alert ? 'text-amber-700' : 'text-gray-400'}`}>
                {metric.label}
              </span>
              <div className={`p-1.5 bg-white border ${metric.alert ? 'border-amber-200' : 'border-gray-100'}`}>
                {metric.icon}
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#1A1A1A] tabular-nums tracking-tight">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
