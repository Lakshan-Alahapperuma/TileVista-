import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import { useDesignerStore } from '../../store/designer.store';
import { calculateDesignTileSummary } from './tileCalculation';

export default function DesignerToolbar({ onSave, readOnly = false }: { onSave: () => Promise<void>, readOnly?: boolean }) {
  if (readOnly) return null;

  const store = useDesignerStore();
  const catalogItems = useDesignerStore((s) => s.catalogItems);

  const isBathroom = store.state?.designType === 'bathroom' || store.selectedRoomType === 'bathroom';
  const tileSummary = calculateDesignTileSummary(store.state, catalogItems, store.wastagePercent, store.customWastageTiles);
  const placedTotal = isBathroom ? store.placedItems.reduce((acc, item) => acc + (item.cost || 0), 0) : 0;
  const totalPrice = placedTotal + tileSummary.totalTileCost;

  return (
    <>
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-30 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            id="btn-menu"
            onClick={() => { window.location.href = '/designer'; }}
            className="w-12 h-12 bg-white hover:bg-gray-50 border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-[#1A1A1A] transition-all"
            title="Back to Designer"
          >
            <Menu size={18} />
          </button>
          <button
            id="btn-save"
            onClick={onSave}
            disabled={store.isSubmitting}
            className={`px-6 h-12 bg-white hover:bg-gray-50 border border-gray-200 shadow-lg rounded-full flex items-center justify-center gap-2 font-bold text-xs tracking-wider uppercase text-[#1A1A1A] transition-all ${store.isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {store.isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-30 pointer-events-auto">
        <div id="price-display" className="bg-white border border-gray-200 shadow-lg rounded-full h-12 px-2 py-1 flex items-center gap-4">
          <div className="flex items-center gap-2 pl-4">
            <span className="font-bold text-sm text-gray-400">LKR</span>
            <span className="font-mono font-bold text-base text-[#1A1A1A]">{totalPrice.toFixed(2)}</span>
          </div>
          <button
            id="btn-summary"
            onClick={() => store.setShowSummaryModal(true)}
            className="px-5 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-[#1A1A1A] transition-all"
          >
            Summary
            <ArrowLeft className="rotate-180" size={10} />
          </button>
        </div>
      </div>
    </>
  );
}
