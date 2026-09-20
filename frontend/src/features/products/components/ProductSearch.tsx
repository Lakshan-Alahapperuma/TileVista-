import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Category } from '../types';

interface ProductSearchProps {
  search: string;
  setSearch: (val: string) => void;
  onSearch: () => void;
  loading: boolean;
  activeCategory: Category | null;
}

export const ProductSearch: React.FC<ProductSearchProps> = React.memo(({ search, setSearch, onSearch, loading, activeCategory }) => {
  const placeholderText = activeCategory 
    ? `Search ${activeCategory.name}...` 
    : 'Search catalog...';

  // Handle enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
      <div className="relative flex-grow md:w-72">
        <input
          type="text"
          placeholder={placeholderText}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3 pl-10 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
        />
        <Search size={14} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      <button
        onClick={onSearch}
        disabled={loading}
        className="bg-[#1A1A1A] hover:bg-[#D4C5B9] text-white hover:text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase px-6 py-3 transition-colors flex items-center justify-center disabled:opacity-50"
      >
        <span>Search</span>
      </button>
    </div>
  );
});

ProductSearch.displayName = 'ProductSearch';
