import React, { useState } from 'react';
import { SalesTrendPoint } from '../../../types/analytics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../../../components/Button';

interface SalesTrendChartProps {
  data: SalesTrendPoint[];
  isLoading: boolean;
  error: string | null;
}

type MetricType = 'REVENUE' | 'PROFIT' | 'UNITS';

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data = [], isLoading, error }) => {
  const [metric, setMetric] = useState<MetricType>('REVENUE');

  const chartData = Array.isArray(data) ? data : (data as any)?.data || [];
  const formattedData = chartData.map((d: any) => ({
    ...d,
    revenue: d.revenue ?? d.netRevenue ?? d.grossRevenue ?? 0,
    profit: d.profit ?? 0,
    units: d.unitsSold ?? d.netUnitsSold ?? 0,
  }));

  const hasProfitData = formattedData.some((d: any) => d.profit > 0);

  const getMetricConfig = () => {
    switch (metric) {
      case 'PROFIT':
        return { dataKey: 'profit', color: '#6A7B58', label: 'PROFIT', isCurrency: true }; // Muted Sage
      case 'UNITS':
        return { dataKey: 'units', color: '#8B5E2B', label: 'UNITS SOLD', isCurrency: false }; // Muted Bronze
      case 'REVENUE':
      default:
        return { dataKey: 'revenue', color: '#3E5C76', label: 'REVENUE', isCurrency: true }; // Muted Steel
    }
  };

  const config = getMetricConfig();

  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 mb-6 gap-4">
        <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">
          Sales Performance Trends
        </h3>
        <div className="flex bg-gray-50 p-1 border border-gray-200">
          <button
            onClick={() => setMetric('REVENUE')}
            className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${metric === 'REVENUE' ? 'bg-[#3E5C76] text-white' : 'text-gray-500 hover:text-[#3E5C76]'}`}
          >
            Revenue
          </button>
          {hasProfitData && (
            <button
              onClick={() => setMetric('PROFIT')}
              className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${metric === 'PROFIT' ? 'bg-[#6A7B58] text-white' : 'text-gray-500 hover:text-[#6A7B58]'}`}
            >
              Profit
            </button>
          )}
          <button
            onClick={() => setMetric('UNITS')}
            className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${metric === 'UNITS' ? 'bg-[#8B5E2B] text-white' : 'text-gray-500 hover:text-[#8B5E2B]'}`}
          >
            Units Sold
          </button>
        </div>
      </div>
      
      <div className="flex-grow w-full relative">
        {error ? (
          <div className="flex flex-col h-full items-center justify-center space-y-4">
            <span className="text-[#1A1A1A] text-sm font-medium">Unable to load trend data.</span>
            <Button variant="secondary" className="text-[#1A1A1A] border-[#E5E5E3] rounded-none hover:bg-gray-50 text-xs" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex h-full w-full items-end gap-2 px-4 pb-8">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex-1 bg-gray-100 animate-pulse" style={{ height: `${Math.random() * 60 + 20}%` }} />
            ))}
          </div>
        ) : formattedData.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center gap-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">No data for selected period</p>
            <p className="text-xs text-gray-500">Adjust the date range to see sales trends.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E3" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#A69485', fontSize: 10, fontFamily: 'monospace' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#A69485', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(value) => `${Number(value).toLocaleString()}`}
                width={70}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '0px', border: '1px solid #E5E5E3', boxShadow: 'none', backgroundColor: '#F9F9F7' }}
                labelStyle={{ color: '#1A1A1A', fontWeight: 'bold', marginBottom: '4px', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}
                itemStyle={{ color: '#1A1A1A', fontFamily: 'monospace', fontSize: '12px' }}
                formatter={(value: any) => [
                  config.isCurrency ? `LKR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Number(value).toLocaleString(), 
                  config.label
                ]}
              />
              <Line 
                type="stepAfter" 
                dataKey={config.dataKey} 
                stroke={config.color} 
                strokeWidth={2}
                dot={{ r: 3, fill: config.color, strokeWidth: 0 }} 
                activeDot={{ r: 5, fill: '#D4C5B9' }} 
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
