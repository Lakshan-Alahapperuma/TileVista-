import React from 'react';
import { Category } from '../types';

interface SubcategoryNavProps {
  activeCategory: Category | null;
  selectedSubcategoryId: number | 'ALL';
  setSelectedSubcategoryId: (id: number | 'ALL') => void;
}

export const SubcategoryNav: React.FC<SubcategoryNavProps> = React.memo(({
  activeCategory,
  selectedSubcategoryId,
  setSelectedSubcategoryId,
}) => {
  if (!activeCategory || !activeCategory.subcategories || activeCategory.subcategories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4 pt-4 pb-6 mb-4">
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mr-2">Subcategories:</span>
        <button
          onClick={() => setSelectedSubcategoryId('ALL')}
          className={`px-4 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${selectedSubcategoryId === 'ALL'
            ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]'
            : 'bg-white border border-gray-200 text-gray-500 hover:text-[#1A1A1A] hover:border-[#1A1A1A]'
            }`}
        >
          All {activeCategory.name}
        </button>
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        {activeCategory.subcategories.map((sub: any) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubcategoryId(sub.id)}
            className={`px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-all duration-300 ${selectedSubcategoryId === sub.id
              ? 'bg-[#D4C5B9] text-[#1A1A1A] border border-[#D4C5B9]'
              : 'bg-white border border-gray-200 text-gray-500 hover:text-[#1A1A1A] hover:border-[#D4C5B9]'
              }`}
          >
            {sub.name}
          </button>
        ))}
      </div>
    </div>
  );
});

SubcategoryNav.displayName = 'SubcategoryNav';
