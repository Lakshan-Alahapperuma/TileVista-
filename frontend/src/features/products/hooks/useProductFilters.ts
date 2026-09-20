import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { UnifiedItem, Category } from '../types';
import { fetchAvailableFilters } from '../api/products.api';

export interface ProductFilters {
  categoryId?: number;
  subcategoryId?: number;
  search?: string;
  brand?: string;
  material?: string;
  finish?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface AvailableFilters {
  brands: string[];
  materials: string[];
  finishes: string[];
  sizes: string[];
}

const EMPTY_AVAILABLE_FILTERS: AvailableFilters = {
  brands: [],
  materials: [],
  finishes: [],
  sizes: [],
};

export const useProductFilters = (categories: Category[], categorySlug?: string) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const parseSubcategoryParam = (value: string | null | undefined): number | 'ALL' => {
    if (!value || value === 'ALL') return 'ALL';
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 'ALL' : parsed;
  };

  const [selectedSubcategoryId, setSelectedSubcategoryIdState] = useState<number | 'ALL'>(
    parseSubcategoryParam(searchParams?.get('subcategoryId'))
  );

  // Search box text. Synced to the URL so it survives refresh / back-forward nav,
  // same as subcategoryId.
  const [search, setSearchState] = useState(searchParams?.get('search') ?? '');

  // Sync local state when the URL changes from outside this hook (e.g. back/forward nav).
  useEffect(() => {
    setSelectedSubcategoryIdState(parseSubcategoryParam(searchParams?.get('subcategoryId')));
    setSearchState(searchParams?.get('search') ?? '');
  }, [searchParams]);

  // "Advanced" facet filters. These are staged locally and only take effect
  // once applyFilters() is called (e.g. from an "Apply" button in the UI).
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  // The filters that have actually been "applied" (i.e. should drive data fetching).
  // categoryId/subcategoryId update immediately on navigation; the facet filters
  // above only flow into this object when applyFilters() runs.
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>({});

  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>(
    EMPTY_AVAILABLE_FILTERS
  );

  const activeCategory = useMemo(() => {
    if (!categorySlug || !categories.length) return null;
    return (
      categories.find(
        (c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === categorySlug
      ) || null
    );
  }, [categories, categorySlug]);

  const updateUrlParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setSelectedSubcategoryId = useCallback(
    (id: number | 'ALL') => {
      setSelectedSubcategoryIdState(id);
      updateUrlParams({ subcategoryId: id === 'ALL' ? undefined : id.toString() });
    },
    [updateUrlParams]
  );

  const resetSubcategory = useCallback(
    () => setSelectedSubcategoryId('ALL'),
    [setSelectedSubcategoryId]
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
    },
    []
  );

  // Category/subcategory changes apply immediately (they come from navigation,
  // not from an explicit "Apply" action).
  useEffect(() => {
    setAppliedFilters((prev) => ({
      ...prev,
      categoryId: activeCategory?.id,
      subcategoryId: selectedSubcategoryId === 'ALL' ? undefined : selectedSubcategoryId,
    }));
  }, [activeCategory?.id, selectedSubcategoryId]);

  const applyFilters = useCallback(() => {
    setAppliedFilters((prev) => ({
      ...prev,
      categoryId: activeCategory?.id,
      subcategoryId: selectedSubcategoryId === 'ALL' ? undefined : selectedSubcategoryId,
      search: search || undefined,
      brand: selectedBrands.length > 0 ? selectedBrands.join(',') : undefined,
      material: selectedMaterials.length > 0 ? selectedMaterials.join(',') : undefined,
      finish: selectedFinishes.length > 0 ? selectedFinishes.join(',') : undefined,
      size: selectedSizes.length > 0 ? selectedSizes.join(',') : undefined,
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
    }));
    
    updateUrlParams({ search: search || undefined });
  }, [
    activeCategory?.id,
    selectedSubcategoryId,
    search,
    selectedBrands,
    selectedMaterials,
    selectedFinishes,
    selectedSizes,
    priceRange.min,
    priceRange.max,
    updateUrlParams,
  ]);

  const resetFilters = useCallback(() => {
    setSelectedBrands([]);
    setSelectedMaterials([]);
    setSelectedFinishes([]);
    setSelectedSizes([]);
    setPriceRange({});
    setAppliedFilters({
      categoryId: activeCategory?.id,
      subcategoryId: selectedSubcategoryId === 'ALL' ? undefined : selectedSubcategoryId,
      search: search || undefined,
    });
  }, [activeCategory?.id, selectedSubcategoryId, search]);

  // Fetch available filter options when the active category changes.
  // Guards against a slow, stale request overwriting a newer one.
  const requestIdRef = useRef(0);
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    
    // Clear filters immediately to prevent flashing old values
    setAvailableFilters(EMPTY_AVAILABLE_FILTERS);

    fetchAvailableFilters(activeCategory?.id)
      .then((result) => {
        if (requestIdRef.current === requestId) {
          setAvailableFilters(result);
        }
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          console.error(err);
          setAvailableFilters(EMPTY_AVAILABLE_FILTERS);
        }
      });
  }, [activeCategory?.id]);

  return {
    search,
    setSearch,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    activeCategory,
    resetSubcategory,

    // Filter state
    availableFilters,
    selectedBrands,
    setSelectedBrands,
    selectedMaterials,
    setSelectedMaterials,
    selectedFinishes,
    setSelectedFinishes,
    selectedSizes,
    setSelectedSizes,
    priceRange,
    setPriceRange,

    // The finalized filter object to pass to the API
    appliedFilters,
    applyFilters,
    resetFilters,
  };
};