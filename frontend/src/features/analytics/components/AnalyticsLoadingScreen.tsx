import React from 'react';
import { Loader2 } from 'lucide-react';

export const AnalyticsLoadingScreen: React.FC = () => {
  return (
    <div className="font-sans space-y-6 animate-in fade-in duration-300">
      <div>
        <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Store Console</span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A] mt-1.5">Business Analytics</h1>
        <p className="text-xs text-gray-500 font-light mt-1">Review showroom trends, sales metrics, and actionable decisions.</p>
      </div>

      {/* Clean Centered Showroom OS Loader */}
      <div className="bg-white border border-gray-200 py-32 px-8 shadow-sm flex flex-col items-center justify-center text-center gap-4">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-widest uppercase font-mono text-[#1A1A1A]">
            Loading Analytics Data...
          </span>
          <p className="text-[11px] text-gray-400 font-light">
            Synchronizing showroom POS records and forecasting metrics
          </p>
        </div>
      </div>
    </div>
  );
};
export default AnalyticsLoadingScreen;
