import React, { useState } from 'react';
import { ProductPerformance } from '../../../types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TopPerformanceChartProps {
  data: ProductPerformance[];
  isLoading: boolean;
  error: string | null;
}

type MetricType = 'REVENUE' | 'UNITS';

export const TopPerformanceChart: React.FC<TopPerformanceChartProps> = ({ data = [], isLoading, error }) => {
  const [metric, setMetric] = useState<MetricType>('REVENUE');

  const chartData = Array.isArray(data) ? data : (data as any)?.data || [];
  
  // Format and sort based on selected metric
  const formattedData = [...chartData]
    .map((d: any) => ({
      ...d,
      name: d.name || 'Unknown',
      revenue: d.revenue ?? d.netRevenue ?? d.grossRevenue ?? 0,
      units: d.unitsSold ?? d.netUnitsSold ?? 0,
    }))
    .sort((a, b) => (metric === 'REVENUE' ? b.revenue - a.revenue : b.units - a.units))
    .slice(0, 10);

  const isCurrency = metric === 'REVENUE';
  const dataKey = metric === 'REVENUE' ? 'revenue' : 'units';
  const label = metric === 'REVENUE' ? 'REVENUE' : 'UNITS SOLD';
  const barColor = metric === 'REVENUE' ? '#3E5C76' : '#8B5E2B';

  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 mb-6 gap-4">
        <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">
          Top Product Performance
        </h3>
        <div className="flex bg-gray-50 p-1 border border-gray-200">
          <button
            onClick={() => setMetric('REVENUE')}
            className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${metric === 'REVENUE' ? 'bg-[#3E5C76] text-white' : 'text-gray-500 hover:text-[#3E5C76]'}`}
          >
            Revenue
          </button>
          <button
            onClick={() => setMetric('UNITS')}
            className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors ${metric === 'UNITS' ? 'bg-[#8B5E2B] text-white' : 'text-gray-500 hover:text-[#8B5E2B]'}`}
          >
            Units Sold
          </button>
        </div>
      </div>
      
      <div className="flex-grow w-full">
        {error ? (
          <div className="flex flex-col h-full items-center justify-center gap-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">Data Unavailable</p>
            <p className="text-xs text-gray-500">Unable to load product performance.</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col h-full w-full justify-around gap-2 px-4 pb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 animate-pulse h-6" style={{ width: `${Math.random() * 60 + 20}%` }} />
            ))}
          </div>
        ) : formattedData.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center gap-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">No data for selected period</p>
            <p className="text-xs text-gray-500">Adjust the date range to see top products.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E5E3" />
              <XAxis 
                type="number"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#A69485', fontSize: 10, fontFamily: 'monospace' }} 
                tickFormatter={(value) => `${Number(value).toLocaleString()}`}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#1A1A1A', fontSize: 11, fontWeight: 500 }}
                width={150}
              />
              <Tooltip 
                cursor={{ fill: '#F9F9F7' }}
                contentStyle={{ borderRadius: '0px', border: '1px solid #E5E5E3', boxShadow: 'none', backgroundColor: '#F9F9F7' }}
                labelStyle={{ color: '#1A1A1A', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}
                itemStyle={{ color: '#1A1A1A', fontFamily: 'monospace', fontSize: '12px' }}
                formatter={(value: any) => [
                  isCurrency ? `LKR ${Number(value).toLocaleString()}` : Number(value).toLocaleString(), 
                  label
                ]}
              />
              <Bar 
                dataKey={dataKey} 
                barSize={20}
                isAnimationActive={false}
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={(entry[dataKey] as number) < 0 ? '#ef4444' : barColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
