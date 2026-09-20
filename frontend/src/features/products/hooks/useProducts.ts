import { useState, useEffect, useCallback } from 'react';
import { UnifiedItem, Category } from '../types';
import { fetchProducts, fetchCategories } from '../api/products.api';

export const useProducts = (filters: any = {}) => {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // We stringify filters to safely use it in the dependency array
  const filtersString = JSON.stringify(filters);

  const loadData = useCallback(async (abortSignal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setItems([]); // Clear items immediately when load/filter changes to prevent stale content flash
    try {
      const parsedFilters = JSON.parse(filtersString);
      if (parsedFilters.__pause) {
        return; // Skip fetching, keep items empty and loading true
      }
      const itemsData = await fetchProducts(parsedFilters);
      if (abortSignal?.aborted) return;
      setItems(itemsData);
    } catch (err: any) {
      if (abortSignal?.aborted) return;
      setError(err.message || 'An error occurred while fetching the catalog.');
    } finally {
      if (!abortSignal?.aborted && !JSON.parse(filtersString).__pause) {
        setLoading(false);
      }
    }
  }, [filtersString]);

  useEffect(() => {
    const abortController = new AbortController();
    loadData(abortController.signal);
    return () => abortController.abort();
  }, [loadData]);

  return { items, loading, error, reload: loadData };
};

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  return { categories };
};
