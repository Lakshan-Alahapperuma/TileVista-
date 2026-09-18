import React, { useState, useMemo } from 'react';
import { DecisionRecommendation } from '../../../types/analytics';
import { Search } from 'lucide-react';

interface DecisionSupportPanelProps {
  recommendations: DecisionRecommendation[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// ── Mappings & Formatting ─────────────────────────────────────────────────────

const DEMAND_CLASS_LABELS: Record<string, string> = {
  INTERMITTENT: 'Occasional / Intermittent',
  LUMPY: 'Unpredictable / Lumpy',
  SMOOTH: 'Consistent / Smooth',
  ERRATIC: 'Highly Variable / Erratic'
};

const TYPE_META: Record<string, { label: string; icon: string; border: string; bg: string; text: string }> = {
  CRITICAL_RESTOCK: {
    label: 'Critical Restock',
    icon: '⚠️',
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    text: 'text-red-900',
  },
  LUMPY_WARNING: {
    label: 'Lumpy Demand Warning',
    icon: '⚡',
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
  },
  OVERSTOCK_CLEARANCE: {
    label: 'Overstock Alert',
    icon: '📦',
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
  },
  STABLE_INVENTORY: {
    label: 'Stable Inventory',
    icon: '✅',
    border: 'border-l-green-500',
    bg: 'bg-green-50',
    text: 'text-green-900',
  },
};

function fmtDemand(t: string | undefined | null): string {
  if (!t) return '—';
  return DEMAND_CLASS_LABELS[t.toUpperCase()] || t;
}

function fmtAction(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/\bROQ\b/g, 'Recommended Order');
}

function getMeta(type: string) {
  return TYPE_META[type] || TYPE_META.STABLE_INVENTORY;
}

// ── Single recommendation card ───────────────────────────────────────────────
const RecommendationCard: React.FC<{ rec: DecisionRecommendation; index: number }> = ({ rec, index }) => {
  const [reviewed, setReviewed] = useState(false);
  const meta = getMeta(rec.recommendationType);

  return (
    <div className={`border border-gray-200 bg-white shadow-sm transition-opacity ${reviewed ? 'opacity-50' : 'opacity-100'}`}>
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#F9F9F7]">
        <h4 className="font-bold text-base text-[#1A1A1A]">{rec.productName}</h4>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm ${meta.bg} ${meta.text}`}>
          <span className="text-sm">{meta.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">{meta.label}</span>
        </div>
      </div>

      {/* ── Recommendation Highlight Box (Top) ── */}
      <div className={`m-4 p-4 border border-gray-100 border-l-4 ${meta.border} bg-gray-50/50`}>
        <p className="font-bold text-[#1A1A1A] text-sm">
          {fmtAction(rec.recommendedAction)}
        </p>
        {rec.reason && (
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            {fmtAction(rec.reason)}
          </p>
        )}
      </div>

      {/* ── 2-Column Data Grid ── */}
      <div className="grid grid-cols-2 gap-4 px-4 pb-4">
        <div>
          <span className="text-[9px] font-bold tracking-widest uppercase text-[#A69485] block mb-1">
            Current Stock
          </span>
          <span className="text-lg font-mono font-bold text-[#1A1A1A] tabular-nums leading-none">
            {rec.currentStock}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-bold tracking-widest uppercase text-[#A69485] block mb-1">
            30-Day Forecast
          </span>
          <span className="text-lg font-mono font-bold text-[#1A1A1A] tabular-nums leading-none">
            {rec.forecast30d}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-bold tracking-widest uppercase text-[#A69485] block mb-1">
            Demand Pattern
          </span>
          <span className="text-xs font-mono font-bold text-[#1A1A1A] uppercase tracking-wider">
            {fmtDemand(rec.demandClass)}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-bold tracking-widest uppercase text-[#A69485] block mb-1">
            Category
          </span>
          <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
            {rec.category || '—'}
          </span>
        </div>
      </div>

      {/* ── Reviewed Checkbox & Timestamp ── */}
      <div className="border-t border-gray-100 p-3 bg-[#F9F9F7] flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            className="w-4 h-4 rounded-sm border-gray-300 text-[#1A1A1A] focus:ring-[#1A1A1A]"
          />
          <span className="text-xs font-semibold text-[#1A1A1A] group-hover:text-black">
            Mark as reviewed
          </span>
        </label>
        <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
          Added Today
        </span>
      </div>

    </div>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────
export const DecisionSupportPanel: React.FC<DecisionSupportPanelProps> = ({
  recommendations = [],
  isLoading,
  error,
  onRetry,
}) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Standardize input array
  const recList: DecisionRecommendation[] = Array.isArray(recommendations)
    ? recommendations
    : (recommendations as any)?.data ?? [];

  // Filter out 'NONE' priority natively, then apply user search and filters
  const actionable = useMemo(() => {
    let list = recList.filter((r) => r.priority !== 'NONE');
    
    if (filter !== 'ALL') {
      list = list.filter(r => r.recommendationType === filter);
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.productName.toLowerCase().includes(q));
    }
    
    return list;
  }, [recList, filter, search]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const totalPages = Math.ceil(actionable.length / ITEMS_PER_PAGE);
  const paginatedActionable = actionable.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 p-8 shadow-sm">
        <SectionHeader />
        <div className="space-y-4 mt-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse border border-gray-100 bg-white">
              <div className="flex justify-between p-4 bg-[#F9F9F7] border-b border-gray-100">
                <div className="h-4 w-32 bg-gray-200" />
                <div className="h-5 w-24 bg-gray-200" />
              </div>
              <div className="m-4 h-16 bg-gray-100 border-l-4 border-gray-200" />
              <div className="grid grid-cols-2 gap-4 px-4 pb-4">
                <div className="h-10 bg-gray-100" />
                <div className="h-10 bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white border border-gray-200 p-8 shadow-sm">
        <SectionHeader />
        <div className="mt-6 py-10 flex flex-col items-center gap-3 border border-gray-100 bg-[#F9F9F7]">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">
            Decision Support Unavailable
          </p>
          <p className="text-xs text-gray-500">Unable to retrieve recommendations.</p>
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            className="mt-2 h-8 px-5 border border-gray-300 text-[10px] font-semibold tracking-widest uppercase text-[#1A1A1A] hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Populated state ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm">
      <SectionHeader />

      {/* ── Quick Filters & Search ── */}
      <div className="mt-6 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[#1A1A1A] transition-colors"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'CRITICAL_RESTOCK', 'LUMPY_WARNING', 'OVERSTOCK_CLEARANCE'].map(f => {
            const isActive = filter === f;
            const label = f === 'ALL' ? 'All Alerts' : getMeta(f).label;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A] ${
                  isActive 
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' 
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Empty State (after filtering) ── */}
      {actionable.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2 border border-dashed border-gray-200 bg-[#F9F9F7]">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A]">
            No Alerts Found
          </p>
          <p className="text-xs text-gray-500 text-center max-w-sm">
            {recList.length === 0 
              ? "Current inventory conditions do not require immediate decision-support action." 
              : "No items match your current filter and search criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedActionable.map((rec, idx) => (
            <RecommendationCard key={rec.productId ?? idx} rec={rec} index={idx} />
          ))}

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1.5 border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1.5 border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Shared section header ─────────────────────────────────────────────────────
const SectionHeader: React.FC = () => (
  <div className="pb-4 border-b border-gray-100">
    <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">
      Decision Support Engine
    </h3>
    <p className="text-xs text-gray-500 font-light mt-1">
      Inventory recommendations based on recent sales trends and 30-day forecasts.
    </p>
  </div>
);
