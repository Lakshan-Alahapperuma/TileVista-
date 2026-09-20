import React from 'react';
import type { useProductFilters } from '../hooks/useProductFilters';

type ProductFilterState = ReturnType<typeof useProductFilters>;

interface ProductFiltersProps {
  filterState: ProductFilterState;
}

export const ProductFilters: React.FC<ProductFiltersProps> = React.memo(({ filterState }) => {
  const {
    availableFilters,
    selectedBrands,
    setSelectedBrands,
    selectedMaterials,
    setSelectedMaterials,
    selectedFinishes,
    setSelectedFinishes,
    selectedSizes,
    setSelectedSizes,
    applyFilters,
    resetFilters
  } = filterState;

  const toggleArrayItem = (item: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(item)) {
      setter(current.filter(i => i !== item));
    } else {
      setter([...current, item]);
    }
  };

  const brands = availableFilters?.brands || [];
  const materials = availableFilters?.materials || [];
  const colors = availableFilters?.finishes || [];
  const sizes = availableFilters?.sizes || [];

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="mb-2">
        <h3 className="text-sm font-bold tracking-widest uppercase text-[#1A1A1A] mb-1">Filters</h3>
        <p className="text-[10px] text-gray-500 font-light uppercase tracking-wider">Refine your search</p>
      </div>

      {brands.length > 0 && (
        <div className="border-t border-gray-150 pt-6">
          <h4 className="text-xs font-semibold tracking-wider uppercase mb-4">Brand</h4>
          <div className="flex flex-col gap-3 text-xs text-gray-600">
            {brands.map((b: string) => (
              <label key={b} className="flex items-center gap-2 cursor-pointer hover:text-black">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b)}
                  onChange={() => toggleArrayItem(b, selectedBrands, setSelectedBrands)}
                  className="accent-black"
                /> {b}
              </label>
            ))}
          </div>
        </div>
      )}

      {materials.length > 0 && (
        <div className="border-t border-gray-150 pt-6">
          <h4 className="text-xs font-semibold tracking-wider uppercase mb-4">Material</h4>
          <div className="flex flex-col gap-3 text-xs text-gray-600">
            {materials.map((m: string) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer hover:text-black">
                <input
                  type="checkbox"
                  checked={selectedMaterials.includes(m)}
                  onChange={() => toggleArrayItem(m, selectedMaterials, setSelectedMaterials)}
                  className="accent-black"
                /> {m}
              </label>
            ))}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="border-t border-gray-150 pt-6">
          <h4 className="text-xs font-semibold tracking-wider uppercase mb-4">Colour</h4>
          <div className="flex flex-wrap gap-2">
            {colors.map((c: string) => (
              <button
                key={c}
                onClick={() => toggleArrayItem(c, selectedFinishes, setSelectedFinishes)}
                className={`px-3 py-1 text-[10px] uppercase font-semibold transition-colors border ${selectedFinishes.includes(c) ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div className="border-t border-gray-150 pt-6">
          <h4 className="text-xs font-semibold tracking-wider uppercase mb-4">Size</h4>
          <div className="grid grid-cols-2 gap-2">
            {sizes.map((s: string) => (
              <button
                key={s}
                onClick={() => toggleArrayItem(s, selectedSizes, setSelectedSizes)}
                className={`border py-2 text-[10px] font-semibold transition-colors ${selectedSizes.includes(s) ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-8 border-t border-gray-150 mt-4 flex gap-3">
        <button
          onClick={resetFilters}
          className="flex-1 bg-white border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] py-3.5 text-xs font-bold tracking-widest uppercase transition-colors"
        >
          Reset
        </button>
        <button
          onClick={applyFilters}
          className="flex-1 bg-[#1A1A1A] hover:bg-[#D4C5B9] text-white hover:text-[#1A1A1A] py-3.5 text-xs font-bold tracking-widest uppercase transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
});

ProductFilters.displayName = 'ProductFilters';
