import { useState, useEffect, useCallback } from 'react';
import { UnifiedItem } from '../types';
import { fetchProductDetails, fetchProducts } from '../api/products.api';

export const useProduct = (id: number | null) => {
  const [product, setProduct] = useState<UnifiedItem | null>(null);
  const [allProducts, setAllProducts] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [productData, allData] = await Promise.all([
        fetchProductDetails(id),
        fetchProducts().catch(() => [] as UnifiedItem[]), // Fallback
      ]);
      setProduct(productData);
      setAllProducts(allData);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching product details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const relatedItems = (() => {
    if (!product) return [];

    // 1. Try matching subcategory
    if (product.subcategoryId !== null && product.subcategoryId !== undefined) {
      const sameSubcategory = allProducts.filter(
        (item) =>
          item.isEnabled &&
          item.subcategoryId !== null &&
          item.subcategoryId === product.subcategoryId &&
          item.itemId !== product.itemId
      );
      if (sameSubcategory.length > 0) {
        return sameSubcategory.slice(0, 3);
      }
    }

    // 2. Fallback to matching parent category
    if (product.categoryId !== null && product.categoryId !== undefined) {
      const sameCategory = allProducts.filter(
        (item) =>
          item.isEnabled &&
          item.categoryId !== null &&
          item.categoryId === product.categoryId &&
          item.itemId !== product.itemId
      );
      return sameCategory.slice(0, 3);
    }

    return [];
  })();

  return { product, relatedItems, loading, error, reload: loadData };
};
