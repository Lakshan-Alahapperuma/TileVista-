'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useCategories, useProducts } from './hooks/useProducts';
import { useProductFilters } from './hooks/useProductFilters';
import { usePagination } from './hooks/usePagination';
import { ITEMS_PER_PAGE } from './constants';
import { ProductHeader } from './components/ProductHeader';
import { ProductSearch } from './components/ProductSearch';
import { ProductFilters } from './components/ProductFilters';
import { ProductGrid } from './components/ProductGrid';
import { Pagination } from './components/Pagination';
import { SubcategoryNav } from './components/SubcategoryNav';

interface ProductListProps {
  categorySlug?: string;
}

export const ProductList: React.FC<ProductListProps> = ({ categorySlug }) => {
  const { categories } = useCategories();
  const filterState = useProductFilters(categories, categorySlug);

  // If we are on a category page (categorySlug exists), wait until activeCategory is resolved
  // AND the applied filters have been updated to match the active category ID.
  // Otherwise, we fetch the whole catalog initially which flashes wrong items.
  const isReadyToFetch = !categorySlug || (filterState.activeCategory !== null && filterState.appliedFilters.categoryId === filterState.activeCategory.id);
  const initialFilters = isReadyToFetch ? filterState.appliedFilters : { __pause: true };

  const { items, loading, error, reload } = useProducts(initialFilters);

  const {
    search,
    setSearch,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    activeCategory,
  } = filterState;

  const {
    currentPage,
    totalPages,
    startIndex,
    getPageNumbers,
    goToPage,
  } = usePagination(items.length, ITEMS_PER_PAGE, [filterState.appliedFilters]);

  const paginatedProducts = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const displayTitle = activeCategory
    ? `${activeCategory.name} Collection`
    : categorySlug
      ? `${categorySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Collection`
      : 'Product Catalog';

  const displaySubtitle = activeCategory || categorySlug
    ? `Explore our premium range of ${(activeCategory?.name || categorySlug || '').toLowerCase().replace(/-/g, ' ')}`
    : 'Browse our extensive catalog';

  return (
    <div className="py-8 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-12">

      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A] capitalize">
            {displayTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-light">
            {displaySubtitle}
          </p>
        </div>
        <ProductSearch
          search={search}
          setSearch={setSearch}
          onSearch={filterState.applyFilters}
          loading={loading}
          activeCategory={activeCategory}
        />
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-gray-400 gap-3">
          <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
          <span className="text-xs font-light tracking-widest uppercase font-mono">Loading...</span>
        </div>
      ) : error ? (
        <div className="py-20 text-center border border-dashed border-red-200 bg-red-50/20 max-w-lg mx-auto p-8 rounded">
          <p className="text-red-650 font-medium text-sm mb-4">{error}</p>
          <button
            onClick={() => reload()}
            className="px-6 py-2.5 bg-red-650 hover:bg-red-700 text-white font-bold text-xs tracking-widest uppercase"
          >
            Retry Catalog
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* LEFT SIDEBAR: Filters */}
          <aside className="w-full lg:w-64 flex-shrink-0 lg:sticky lg:top-24 lg:h-[calc(100vh-120px)] overflow-y-auto pr-6 border-r border-[#D4C5B9]/40 pb-10 thin-scrollbar">
            <ProductFilters filterState={filterState} />
          </aside>

          {/* RIGHT MAIN CONTENT */}
          <main className="flex-grow w-full">
            <SubcategoryNav
              activeCategory={activeCategory}
              selectedSubcategoryId={selectedSubcategoryId}
              setSelectedSubcategoryId={setSelectedSubcategoryId}
            />

            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
                Showing {items.length > 0 ? startIndex + 1 : 0}&ndash;{Math.min(startIndex + ITEMS_PER_PAGE, items.length)} of {items.length} products
              </span>
              {totalPages > 1 && (
                <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            <ProductGrid products={paginatedProducts} />

            <div className="flex flex-col md:flex-row items-center justify-between border-t border-gray-150 pt-4 mt-12 gap-4">
              <span className="text-xs text-gray-500 font-medium">
                Showing {items.length > 0 ? startIndex + 1 : 0}&ndash;{Math.min(startIndex + ITEMS_PER_PAGE, items.length)} of {items.length} products
              </span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                getPageNumbers={getPageNumbers}
                goToPage={goToPage}
              />
            </div>
          </main>
        </div>
      )}
    </div>
  );
};
