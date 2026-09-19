import { useState } from 'react';
import React from 'react';
import { X, ShoppingCart, Layers, Grid } from 'lucide-react';
import { useDesignerStore } from '../../store/designer.store';
import { calculateDesignTileSummary } from './tileCalculation';
import { useCart } from '../../features/cart/hooks/useCart';

export default function SaveDesignModal() {
  const {
    state,
    placedItems,
    catalogItems,
    showSummaryModal,
    setShowSummaryModal,
    wastagePercent,
    customWastageTiles,
    setCustomWastageTile,
    selectedRoomType
  } = useDesignerStore();

  const { addItem } = useCart();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  if (!showSummaryModal) return null;

  const isBathroom = state.designType === 'bathroom' || selectedRoomType === 'bathroom';
  const currentWastage = wastagePercent !== undefined ? wastagePercent : 10;
  const tileSummary = calculateDesignTileSummary(state, catalogItems, currentWastage, customWastageTiles);
  const placedTotal = isBathroom ? placedItems.reduce((acc, item) => acc + (item.cost || 0), 0) : 0;
  const grandTotal = placedTotal + tileSummary.totalTileCost;

  const { floorTileSummary, wallTileSummaries } = tileSummary;
  const hasTiles = !!floorTileSummary || wallTileSummaries.length > 0;
  const isEmpty = !hasTiles && (!isBathroom || placedItems.length === 0);

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      let itemsList = catalogItems && catalogItems.length > 0 ? catalogItems : [];
      if (itemsList.length === 0) {
        const res = await fetch(`${apiUrl}/items`);
        if (res.ok) {
          itemsList = await res.json();
        }
      }

      const findItemId = (target: any) => {
        if (!target) return null;
        const directId = Number(target.itemId || target.item_id || target.osposItemId || target.ospos_item_id || target.id);
        if (!isNaN(directId) && directId > 0 && directId < 100000) {
          const inList = itemsList.find((ci: any) => Number(ci.itemId || ci.item_id || ci.id) === directId);
          if (inList) return directId;
        }
        const matched = itemsList.find((ci: any) => {
          if (ci.name && target.name && ci.name.toLowerCase().trim() === target.name.toLowerCase().trim()) return true;
          if (ci.imageUrl && (target.imageUrl || target.url) && ((target.imageUrl || target.url).includes(ci.imageUrl) || ci.imageUrl.includes(target.imageUrl || target.url))) return true;
          return false;
        });
        if (matched) {
          return Number(matched.itemId || matched.item_id || matched.osposItemId || matched.id);
        }
        if (itemsList.length > 0) {
          return Number(itemsList[0].itemId || itemsList[0].item_id || itemsList[0].id || 1);
        }
        return 1;
      };

      // 1. Add floor tile to cart
      if (floorTileSummary && floorTileSummary.tileCount > 0) {
        const floorItemId = findItemId(state.floorTileItem || floorTileSummary);
        if (floorItemId) {
          await addItem(floorItemId, floorTileSummary.tileCount);
        }
      }

      // 2. Add wall tiles to cart
      for (const wts of wallTileSummaries) {
        if (wts && wts.tileCount > 0) {
          const wallItemId = findItemId(wts);
          if (wallItemId) {
            await addItem(wallItemId, wts.tileCount);
          }
        }
      }

      // 3. Add bathware items to cart (for bathroom designs)
      if (isBathroom) {
        for (const item of placedItems) {
          const bathwareItemId = findItemId(item);
          if (bathwareItemId) {
            await addItem(bathwareItemId, 1);
          }
        }
      }
    } catch (err) {
      console.error("Cart addition error:", err);
    } finally {
      setIsAddingToCart(false);
      window.location.href = '/cart';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white/70 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300 p-4 sm:p-6">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-5 flex justify-between items-center border-b border-gray-100 bg-[#FAF9F6]">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">Design Summary</h2>
            <p className="text-xs font-semibold tracking-wider text-gray-400 mt-0.5 uppercase">Estimated Costs & Materials Breakdown</p>
          </div>
          <button
            onClick={() => setShowSummaryModal(false)}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#1A1A1A] transition-all shadow-sm border border-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white space-y-6">
          {isEmpty ? (
            <div className="text-center py-12">
              <p className="text-sm font-semibold tracking-wide text-gray-400 uppercase">No items or tiles added to the design yet</p>
            </div>
          ) : (
            <>
              {/* Placed Items (Bathware Products for Bathroom designs only) */}
              {isBathroom && placedItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-extrabold tracking-widest text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <Layers size={14} /> Bathware Products ({placedItems.length})
                  </h3>
                  <div className="space-y-2.5">
                    {placedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-3 px-4 rounded-2xl bg-[#FAF9F6] border border-gray-100 group">
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-all">
                            <span className="text-[10px] font-bold tracking-widest uppercase">{item.type.substring(0, 2)}</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#1A1A1A]">{item.name}</h4>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">{item.type.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-sm text-[#1A1A1A]">
                          {isBathroom ? `LKR ${(item.cost || 0).toFixed(2)}` : 'LKR 0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tiles Section */}
              {hasTiles && (
                <div>
                  <h3 className="text-xs font-extrabold tracking-widest text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <Grid size={14} /> Tile Requirements & Pricing
                  </h3>
                  <div className="space-y-4">
                    
                    {/* Floor Tile */}
                    {floorTileSummary && (
                      <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-gray-200/80 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            {floorTileSummary.imageUrl ? (
                              <img src={floorTileSummary.imageUrl} alt="Floor Tile" className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-sm" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">Floor</div>
                            )}
                            <div>
                              <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase block">Floor Tile</span>
                              <h4 className="text-sm font-bold text-[#1A1A1A]">{floorTileSummary.name}</h4>
                              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                Size: {Math.round(floorTileSummary.dimensions.widthM * 100)}×{Math.round(floorTileSummary.dimensions.heightM * 100)} cm | Room Area: {floorTileSummary.surfaceAreaM2.toFixed(2)} m²
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-base text-[#1A1A1A] block">LKR {floorTileSummary.totalCost.toFixed(2)}</span>
                            <span className="text-[10px] font-semibold text-gray-400">LKR {floorTileSummary.pricePerTile.toFixed(2)} / tile</span>
                          </div>
                        </div>

                        {/* Breakdown Grid (3 columns: Net Tiles, Editable Wastage Tiles, Total Tiles) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-gray-200/70 text-xs">
                          <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Net Tiles</span>
                            <span className="font-mono font-bold text-gray-700 text-sm mt-0.5">{floorTileSummary.baseTileCount} pcs</span>
                          </div>

                          <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 flex flex-col justify-center">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-amber-900 font-bold uppercase tracking-wider block">Wastage Tiles</span>
                              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md">
                                +{floorTileSummary.wastagePercent}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-amber-800 font-bold text-sm">+</span>
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={floorTileSummary.wastageTileCount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setCustomWastageTile('floor', isNaN(val) ? 0 : val);
                                }}
                                className="w-20 px-2 py-0.5 bg-white border border-amber-300 rounded-lg text-center font-mono font-extrabold text-sm text-amber-950 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="font-mono font-bold text-amber-800 text-xs">pcs</span>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Required</span>
                            <span className="font-mono font-extrabold text-black text-sm mt-0.5">{floorTileSummary.tileCount} pcs</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Wall Tiles */}
                    {wallTileSummaries.map((wts, idx) => {
                      const tileKey = wts.tileKey || `wall_${idx}`;
                      const labelText = wts.wallLabel || (wts.wallIndex !== undefined ? `Wall ${wts.wallIndex + 1} Tile` : 'Wall Tile');
                      return (
                        <div key={idx} className="p-4 rounded-2xl bg-[#FAF9F6] border border-gray-200/80 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              {wts.imageUrl ? (
                                <img src={wts.imageUrl} alt="Wall Tile" className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-sm" />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">Wall</div>
                              )}
                              <div>
                                <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 uppercase block">
                                  {labelText}
                                </span>
                                <h4 className="text-sm font-bold text-[#1A1A1A]">{wts.name}</h4>
                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                  Size: {Math.round(wts.dimensions.widthM * 100)}×{Math.round(wts.dimensions.heightM * 100)} cm | Wall Area: {wts.surfaceAreaM2.toFixed(2)} m²
                                </p>
                              </div>
                            </div>
                             <div className="text-right">
                              <span className="font-mono font-bold text-base text-[#1A1A1A] block">LKR {wts.totalCost.toFixed(2)}</span>
                              <span className="text-[10px] font-semibold text-gray-400">LKR {wts.pricePerTile.toFixed(2)} / tile</span>
                            </div>
                          </div>

                          {/* Breakdown Grid (3 columns: Net Tiles, Editable Wastage Tiles, Total Tiles) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-gray-200/70 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Net Tiles</span>
                              <span className="font-mono font-bold text-gray-700 text-sm mt-0.5">{wts.baseTileCount} pcs</span>
                            </div>

                            <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 flex flex-col justify-center">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-amber-900 font-bold uppercase tracking-wider block">Wastage Tiles</span>
                                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md">
                                  +{wts.wastagePercent}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-amber-800 font-bold text-sm">+</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  value={wts.wastageTileCount}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setCustomWastageTile(tileKey, isNaN(val) ? 0 : val);
                                  }}
                                  className="w-20 px-2 py-0.5 bg-white border border-amber-300 rounded-lg text-center font-mono font-extrabold text-sm text-amber-950 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="font-mono font-bold text-amber-800 text-xs">pcs</span>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Required</span>
                              <span className="font-mono font-extrabold text-black text-sm mt-0.5">{wts.tileCount} pcs</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-[#FAF9F6] border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">Total Estimated Cost</p>
            <p className="font-mono text-2xl font-extrabold text-[#1A1A1A]">LKR {grandTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            className="h-11 px-7 bg-black hover:bg-[#333] text-white rounded-full flex items-center gap-2.5 font-bold tracking-wider text-xs uppercase shadow-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <ShoppingCart size={16} />
            {isAddingToCart ? 'Adding to Cart...' : 'Add to Cart'}
          </button>
        </div>

      </div>
    </div>
  );
}
