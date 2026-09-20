import React, { useMemo, useState } from 'react';
import { ProductPerformance, ProductVelocity } from '../../../types/analytics';
import { formatCurrency } from '../../../utils';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface PerformanceTableProps {
  performance: ProductPerformance[];
  velocity: ProductVelocity[];
  isLoading: boolean;
  error: string | null;
}

type CombinedPerformance = ProductPerformance & { velocityClassStr: string; demandClass?: string };

const columnHelper = createColumnHelper<CombinedPerformance>();

export const PerformanceTable: React.FC<PerformanceTableProps> = ({ performance = [], velocity = [], isLoading, error }) => {
  const perfList = Array.isArray(performance) ? performance : (performance as any)?.data || [];
  const velList = Array.isArray(velocity) ? velocity : (velocity as any)?.data || [];

  const mergedData = useMemo(() => perfList.map((item: any, idx: number) => {
    const v = velList.find((vel: any) =>
      (vel.productId && item.itemId && vel.productId === item.itemId) ||
      (vel.productName && item.name && vel.productName.toLowerCase() === item.name.toLowerCase())
    );
    return {
      ...item,
      id: item.itemId ?? idx,
      name: item.name || 'Unknown Product',
      unitsSold: item.unitsSold ?? item.netUnitsSold ?? 0,
      revenue: item.revenue ?? item.netRevenue ?? 0,
      velocityClassStr: v?.classification || v?.velocityClass || 'NORMAL',
    };
  }), [perfList, velList]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'revenue', desc: true }]);
  const [velocityFilter, setVelocityFilter] = useState<string>('ALL');

  const filteredData = useMemo(() => {
    if (velocityFilter === 'ALL') return mergedData;
    return mergedData.filter((d: any) => {
      const v = d.velocityClassStr.toUpperCase();
      if (velocityFilter === 'FAST') return v.includes('FAST');
      if (velocityFilter === 'SLOW') return v.includes('SLOW');
      if (velocityFilter === 'NORMAL') return !v.includes('FAST') && !v.includes('SLOW');
      return true;
    });
  }, [mergedData, velocityFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'PRODUCT',
      cell: info => {
        const row = info.row.original;
        const vel = row.velocityClassStr.toUpperCase();
        let dotColor = 'bg-gray-400';
        if (vel.includes('FAST')) dotColor = 'bg-green-500';
        else if (vel.includes('SLOW')) dotColor = 'bg-amber-500';

        const isNegative = (row.revenue ?? 0) < 0;

        return (
          <div className="flex flex-col whitespace-normal min-w-[200px]">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="font-semibold text-[#1A1A1A] leading-snug">
                {info.getValue()}
              </span>
            </div>
            {isNegative && (
              <span className="text-[10px] text-red-600 font-bold mt-1 ml-4 flex items-center gap-1 uppercase tracking-widest">
                <span>⚠️</span> Negative revenue detected
              </span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('unitsSold', {
      header: () => <div className="text-right">UNITS</div>,
      cell: info => <div className="text-right font-mono tabular-nums text-[#1A1A1A]">{info.getValue()}</div>,
    }),
    columnHelper.accessor('velocityClassStr', {
      header: 'VELOCITY',
      cell: info => {
        const val = info.getValue().toUpperCase();
        let bgClass = 'bg-gray-50';
        let textClass = 'text-gray-700';
        let borderClass = 'border-gray-200';

        if (val.includes('FAST')) {
          bgClass = 'bg-green-50';
          textClass = 'text-green-700';
          borderClass = 'border-green-200';
        } else if (val.includes('SLOW')) {
          bgClass = 'bg-amber-50';
          textClass = 'text-amber-700';
          borderClass = 'border-amber-200';
        }

        return (
          <span className={`text-[10px] px-2 py-0.5 border ${bgClass} ${textClass} ${borderClass} font-bold tracking-widest uppercase inline-block whitespace-nowrap`}>
            {val.replace(/_/g, ' ')}
          </span>
        );
      },
    }),
    columnHelper.accessor('revenue', {
      header: () => <div className="text-right">REVENUE</div>,
      cell: info => {
        const val = info.getValue() ?? 0;
        const isNegative = val < 0;
        return (
          <div className={`text-right font-mono tabular-nums font-bold ${isNegative ? 'text-red-600' : 'text-[#1A1A1A]'}`}>
            {formatCurrency(val)}
          </div>
        );
      }
    }),
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white border border-gray-200 shadow-sm h-[520px] flex flex-col overflow-hidden">
      <div className="px-8 py-5 border-b border-gray-100 shrink-0 bg-white z-20 relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase flex items-center gap-2">
            Product Performance
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-lg">
            Track how your catalog is moving. Items with negative revenue are flagged for review.
          </p>
        </div>

        <div className="shrink-0">
          <select
            value={velocityFilter}
            onChange={e => setVelocityFilter(e.target.value)}
            aria-label="Filter by velocity"
            className="text-xs font-bold uppercase tracking-widest border border-gray-200 px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] bg-white cursor-pointer transition-colors hover:border-gray-300"
          >
            <option value="ALL">All Velocities</option>
            <option value="FAST">Fast Moving Only</option>
            <option value="NORMAL">Normal Only</option>
            <option value="SLOW">Slow Moving Only</option>
          </select>
        </div>
      </div>

      <div className="flex-grow overflow-auto bg-white relative px-8">
        {error ? (
          <div className="flex flex-col h-full items-center justify-center gap-3 p-8">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">Performance Data Unavailable</p>
            <p className="text-xs text-gray-500">Unable to load product performance.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 h-8 px-5 border border-gray-300 text-[10px] font-semibold tracking-widest uppercase text-[#1A1A1A] hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A]"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F9F9F7] sticky top-0 z-10 border-b border-[#E5E5E3]">
                <tr>
                  {columns.map((_, i) => <th key={i} className="px-4 py-3 border-r border-[#E5E5E3] last:border-r-0"><div className="h-3 bg-gray-200 w-16 animate-pulse" /></th>)}
                </tr>
              </thead>
              <tbody>
                {[...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-[#E5E5E3]">
                    <td className="px-4 py-3"><div className="h-4 bg-gray-100 w-32 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-100 w-12 animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-100 w-16 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-100 w-24 animate-pulse ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center gap-2 p-8">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">No performance data</p>
            <p className="text-xs text-gray-500">No records match the selected criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-[#F9F9F7] sticky top-0 z-10 border-b border-[#1A1A1A]">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const canSort = header.column.getCanSort();
                    const isSorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-2.5 text-[10px] font-bold tracking-widest text-[#A69485] uppercase border-r border-[#E5E5E3] last:border-r-0 bg-[#F9F9F7] ${canSort ? 'cursor-pointer select-none hover:bg-[#E5E5E3]/50 transition-colors' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1.5" style={{ justifyContent: header.column.id === 'unitsSold' || header.column.id === 'revenue' ? 'flex-end' : 'flex-start' }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-[#1A1A1A] opacity-50 shrink-0">
                              {{
                                asc: <ArrowUp size={12} strokeWidth={3} />,
                                desc: <ArrowDown size={12} strokeWidth={3} />,
                              }[isSorted as string] ?? <ArrowUpDown size={12} className="opacity-30" />}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => {
                const isNegative = (row.original.revenue ?? 0) < 0;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[#E5E5E3] transition-colors group ${isNegative ? 'bg-red-50 hover:bg-red-100/50' : 'hover:bg-[#F9F9F7]/50'
                      }`}
                  >
                    {row.getVisibleCells().map(cell => {
                      // Note: cell.column.id check to avoid white-space nowrap on the name column
                      const isNameCol = cell.column.id === 'name';
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-2.5 text-sm border-r border-[#E5E5E3]/50 last:border-r-0 group-hover:border-[#E5E5E3] transition-colors ${isNameCol ? '' : 'whitespace-nowrap'
                            }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
