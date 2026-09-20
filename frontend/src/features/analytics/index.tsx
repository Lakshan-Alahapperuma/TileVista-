'use client';

import React, { useState, Suspense } from 'react';
import { Calendar } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { KpiCards } from './components/KpiCards';
import { SalesTrendChart } from './components/SalesTrendChart';
import { PerformanceTable } from './components/PerformanceTable';
import { DecisionSupportPanel } from './components/DecisionSupportPanel';
import { InventoryOverview } from './components/InventoryOverview';
import { TopPerformanceChart } from './components/TopPerformanceChart';
import { StockForecastChart } from './components/StockForecastChart';

// ── Inner component (needs Suspense wrapper for useSearchParams) ───────────────
function AnalyticsInner() {
  const today = new Date();
  const defaultEnd = today.toISOString().split('T')[0];
  const defaultStart = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
  const [tempRange, setTempRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

  const searchParams = useSearchParams();
  const activeView = searchParams.get('view'); // used by KpiCards; available here for future section-highlight expansion

  const { data, status } = useAnalyticsData(dateRange);

  const applyDateRange = () => setDateRange(tempRange);

  const resetDateRange = () => {
    const r = { startDate: defaultStart, endDate: defaultEnd };
    setTempRange(r);
    setDateRange(r);
  };

  return (
    <div className="space-y-6 pb-16">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Store Console</span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A] mt-1.5">Business Analytics</h1>
          <p className="text-xs text-gray-500 font-light mt-1">Review showroom trends, sales metrics, and actionable decisions.</p>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Date range filter">
          <label htmlFor="date-from" className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">
            From
          </label>
          <div className="relative flex items-center">
            <Calendar size={14} className="absolute left-3 text-gray-400 pointer-events-none z-10" />
            <input
              id="date-from"
              type="date"
              value={tempRange.startDate}
              onChange={(e) => setTempRange({ ...tempRange, startDate: e.target.value })}
              className="relative h-9 pl-9 pr-3 text-xs text-[#1A1A1A] bg-white border border-gray-200 focus:outline-none focus:border-[#1A1A1A] transition-colors [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </div>
          <label htmlFor="date-to" className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase ml-2">
            To
          </label>
          <div className="relative flex items-center">
            <Calendar size={14} className="absolute left-3 text-gray-400 pointer-events-none z-10" />
            <input
              id="date-to"
              type="date"
              value={tempRange.endDate}
              onChange={(e) => setTempRange({ ...tempRange, endDate: e.target.value })}
              className="relative h-9 pl-9 pr-3 text-xs text-[#1A1A1A] bg-white border border-gray-200 focus:outline-none focus:border-[#1A1A1A] transition-colors [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </div>
          <button
            onClick={applyDateRange}
            className="h-9 px-5 bg-[#1A1A1A] text-white text-[10px] font-semibold tracking-widest uppercase hover:bg-[#2a2a2a] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-1"
          >
            Apply
          </button>
          <button
            onClick={resetDateRange}
            className="h-9 px-4 border border-gray-200 text-[10px] font-semibold tracking-widest uppercase text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-1"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Active KPI banner (shown when a drill-down view is selected) ── */}
      {activeView && (
        <div className="flex items-center gap-3 px-4 py-2 border border-[#D4C5B9] bg-[#FAF7F0] text-[10px] font-mono tracking-widest uppercase text-[#7A5C30]">
          <span>Filtered by: {activeView}</span>
          <span className="text-[#A69485]">— click the active KPI card to clear</span>
        </div>
      )}

      {/* ── KPI Row ── */}
      <KpiCards data={data.kpis} isLoading={status.kpis.isLoading} error={status.kpis.error} />

      {/* ── Sales Trend — full width ── */}
      <SalesTrendChart data={data.trends} isLoading={status.trends.isLoading} error={status.trends.error} />

      {/* ── Inventory Status — full width ── */}
      <InventoryOverview
        data={data.inventory}
        isLoading={status.inventory?.isLoading}
        error={status.inventory?.error}
      />

      {/* ── Row 3: Top Product Performance Horizontal Bar Chart ── */}
      <TopPerformanceChart 
        data={data.performance} 
        isLoading={status.performance.isLoading} 
        error={status.performance.error} 
      />

      {/* ── Row 4: Stock vs Forecast Grouped Bar Chart ── */}
      <StockForecastChart 
        data={data.recommendations} 
        isLoading={status.recommendations.isLoading} 
        error={status.recommendations.error} 
      />

      {/* ── Row 5: Product Performance Table ── */}
      <PerformanceTable
        performance={data.performance}
        velocity={data.velocity}
        isLoading={status.performance.isLoading}
        error={status.performance.error}
      />

      {/* ── Row 6: Decision Support ── */}
      <DecisionSupportPanel
        recommendations={data.recommendations}
        isLoading={status.recommendations.isLoading}
        error={status.recommendations.error}
      />
    </div>
  );
}

// ── Public export — wrapped in Suspense for useSearchParams ───────────────────
export const AnalyticsFeature: React.FC = () => (
  <Suspense fallback={
    <div className="space-y-6 pb-16 animate-pulse">
      <div className="h-12 w-56 bg-gray-200" />
      <div className="grid grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 border border-gray-200" />)}
      </div>
      <div className="h-96 bg-gray-100 border border-gray-200" />
    </div>
  }>
    <AnalyticsInner />
  </Suspense>
);

export default AnalyticsFeature;
