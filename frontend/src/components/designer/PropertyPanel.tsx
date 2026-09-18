
import React from 'react';
import { X, Trash2, RotateCw } from 'lucide-react';
import { useDesignerStore } from '@/store/designer.store';
import { useAuth } from '@/features/auth/AuthContext';


export default function PropertyPanel() {
  const store = useDesignerStore();
  
  const selectedItem = React.useMemo(() => {
    const item = store.placedItems.find(i => i.id === store.selectedItemId);
    if (item) return { ...item, isOpening: false };
    const opening = store.state.wallOpenings.find(op => op.id === store.selectedItemId);
    if (opening) return { ...opening, isOpening: true };
    return null;
  }, [store.placedItems, store.state.wallOpenings, store.selectedItemId]);

  if (!store.selectedItemId || !selectedItem) return null;

  return (
    <div className="absolute top-20 sm:top-24 right-4 sm:right-[440px] w-64 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="font-bold text-sm tracking-wide text-gray-900 uppercase">Properties</h3>
        <button onClick={() => store.setSelectedItemId(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Item Type</label>
          <div className="text-sm font-semibold text-gray-900 bg-gray-100/50 px-3 py-2 rounded-lg border border-gray-100">{selectedItem.name}</div>
        </div>
        {!selectedItem.isOpening && (
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Rotation</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  store.recordHistory(store.placedItems);
                  store.setPlacedItems(prev => prev.map(i => i.id === store.selectedItemId ? { ...i, rotation: i.rotation - Math.PI / 2 } : i));
                }}
                className="flex-1 flex items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 -scale-x-100" /> -90°
              </button>
              <button
                onClick={() => {
                  store.recordHistory(store.placedItems);
                  store.setPlacedItems(prev => prev.map(i => i.id === store.selectedItemId ? { ...i, rotation: i.rotation + Math.PI / 2 } : i));
                }}
                className="flex-1 flex items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" /> +90°
              </button>
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => {
              const targetId = store.selectedItemId;
              if (!targetId) return;
              const targetIdStr = String(targetId);

              if (selectedItem.isOpening) {
                store.setState({ wallOpenings: store.state.wallOpenings.filter(o => String(o.id) !== targetIdStr) });
              } else {
                const nextItems = store.placedItems.filter(i => String(i.id) !== targetIdStr);
                store.recordHistory(nextItems);
                store.setPlacedItems(nextItems);
              }
              store.setSelectedItemId(null);
            }}
            className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Remove Item
          </button>
        </div>
      </div>
    </div>
  );
}
