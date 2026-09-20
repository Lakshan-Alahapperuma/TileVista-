'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TrendingUp, ShoppingBag, BarChart3, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface KpiCardsProps {
  data: any;
  isLoading: boolean;
  error: string | null;
}

// Maps each KPI key to a `view` param value that scrolls/highlights a section.
// Only views that correspond to real existing data are registered here.
const KPI_VIEWS = ['revenue', 'transactions', 'units', 'profit'] as const;
type KpiView = (typeof KPI_VIEWS)[number];

function useKpiDrillDown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeView = searchParams.get('view') as KpiView | null;

  const activate = (view: KpiView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeView === view) {
      params.delete('view');
    } else {
      params.set('view', view);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const deactivate = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return { activeView, activate, deactivate };
}

// ── Trend indicator ───────────────────────────────────────────────────────────
function TrendIndicator({ value }: { value?: number }) {
  if (typeof value !== 'number') return null;
  const isPositive = value >= 0;
  return (
    <div className="mt-3 flex items-baseline gap-1.5">
      <span className="text-[11px] font-mono tabular-nums text-[#A69485]">
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-[10px] text-gray-400">vs prev period</span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-gray-200 p-6 shadow-sm animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-2.5 w-24 bg-gray-200" />
            <div className="h-8 w-8 bg-gray-100" />
          </div>
          <div className="h-7 w-32 bg-gray-200 mt-1" />
          <div className="h-2.5 w-20 bg-gray-100 mt-3" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const KpiCards: React.FC<KpiCardsProps> = ({ data, isLoading, error }) => {
  const { activeView, activate } = useKpiDrillDown();

  if (error) {
    return (
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col items-center justify-center gap-3 py-10">
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">Unable to load KPI data</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 h-8 px-5 border border-gray-300 text-[10px] font-semibold tracking-widest uppercase text-[#1A1A1A] hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) return <KpiSkeleton />;

  const kpis: Array<{
    id: KpiView;
    label: string;
    value: string;
    icon: React.ReactNode;
    trend?: number;
  }> = [
    {
      id: 'revenue',
      label: 'Total Revenue',
      value: formatCurrency(data.totalNetRevenue ?? data.totalRevenue ?? data.totalGrossRevenue ?? 0),
      icon: <TrendingUp size={16} />,
      trend: data.revenueTrend ?? data.trend,
    },
    {
      id: 'transactions',
      label: 'Total Transactions',
      value: `${data.totalTransactions ?? data.totalOrders ?? 0}`,
      icon: <ShoppingBag size={16} />,
      trend: data.transactionTrend,
    },
    {
      id: 'units',
      label: 'Net Units Sold',
      value: `${data.netUnitsSold ?? 0}`,
      icon: <BarChart3 size={16} />,
      trend: data.unitsTrend,
    },
    {
      id: 'profit',
      label: 'Total Profit',
      value: formatCurrency(data.totalProfit ?? 0),
      icon: <DollarSign size={16} />,
      trend: data.profitTrend,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => {
        const isActive = activeView === kpi.id;
        return (
          <button
            key={kpi.id}
            onClick={() => activate(kpi.id)}
            aria-pressed={isActive}
            aria-label={`Filter analytics by ${kpi.label}`}
            className={[
              'text-left p-6 shadow-sm border flex flex-col justify-between transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A]',
              isActive
                ? 'bg-[#1A1A1A] border-[#1A1A1A]'          // Active: charcoal
                : 'bg-white border-gray-200 hover:border-[#D4C5B9]', // Default: white
            ].join(' ')}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span
                  className={[
                    'text-[10px] font-bold tracking-wider uppercase',
                    isActive ? 'text-[#D4C5B9]' : 'text-gray-400',
                  ].join(' ')}
                >
                  {kpi.label}
                </span>
                <div
                  className={[
                    'p-2 border',
                    isActive ? 'bg-white/10 border-white/20 text-[#D4C5B9]' : 'bg-gray-50 border-gray-100 text-[#1A1A1A]',
                  ].join(' ')}
                >
                  {kpi.icon}
                </div>
              </div>
              <p
                className={[
                  'text-2xl font-bold font-mono tracking-tight tabular-nums',
                  isActive ? 'text-white' : 'text-[#1A1A1A]',
                ].join(' ')}
              >
                {kpi.value}
              </p>
            </div>
            <TrendIndicator value={kpi.trend} />
            {isActive && (
              <span className="mt-3 text-[9px] font-mono tracking-widest uppercase text-[#D4C5B9]/70">
                ↳ filtered — click to clear
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
