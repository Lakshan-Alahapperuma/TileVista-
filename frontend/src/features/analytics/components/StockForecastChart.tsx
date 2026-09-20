import React from 'react';
import { DecisionRecommendation } from '../../../types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface StockForecastChartProps {
  data: DecisionRecommendation[];
  isLoading: boolean;
  error: string | null;
}

export const StockForecastChart: React.FC<StockForecastChartProps> = ({ data = [], isLoading, error }) => {
  const chartData = Array.isArray(data) ? data : (data as any)?.data || [];
  
  // Use top 15 recommendations for the grouped bar chart
  const formattedData = [...chartData]
    .filter(d => d.priority !== 'NONE')
    .slice(0, 15)
    .map(d => ({
      name: d.productName,
      Stock: d.currentStock || 0,
      Forecast: d.forecast30d || 0,
    }));

  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-[400px]">
      <div>
        <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase pb-4 border-b border-gray-100 mb-6">
          Stock vs 30-Day Forecast
        </h3>
      </div>
      
      <div className="flex-grow w-full">
        {error ? (
          <div className="flex flex-col h-full items-center justify-center gap-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">Data Unavailable</p>
            <p className="text-xs text-gray-500">Unable to load stock vs forecast data.</p>
          </div>
        ) : isLoading ? (
          <div className="flex h-full w-full items-end gap-4 px-4 pb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex-1 flex gap-1 h-full items-end">
                <div className="w-full bg-gray-200 animate-pulse" style={{ height: `${Math.random() * 50 + 10}%` }} />
                <div className="w-full bg-gray-100 animate-pulse" style={{ height: `${Math.random() * 80 + 20}%` }} />
              </div>
            ))}
          </div>
        ) : formattedData.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center gap-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">No data for selected period</p>
            <p className="text-xs text-gray-500">Adjust the date range to see stock versus forecast.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E3" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#A69485', fontSize: 10 }} 
                dy={10}
                // Truncate long names
                tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#A69485', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip 
                cursor={{ fill: '#F9F9F7' }}
                contentStyle={{ borderRadius: '0px', border: '1px solid #E5E5E3', boxShadow: 'none', backgroundColor: '#F9F9F7' }}
                labelStyle={{ color: '#1A1A1A', fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}
                itemStyle={{ fontFamily: 'monospace', fontSize: '12px', paddingBottom: '4px' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
                formatter={(value) => <span className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A] ml-1">{value}</span>}
              />
              <Bar 
                dataKey="Stock" 
                fill="#A69485" 
                isAnimationActive={false}
              />
              <Bar 
                dataKey="Forecast" 
                fill="#1A1A1A" 
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
