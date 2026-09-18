import { UnifiedItem, Category } from '../types';
import { API_BASE } from '../constants';

export const fetchProducts = async (filters: any = {}): Promise<UnifiedItem[]> => {
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  
  const queryString = queryParams.toString();
  const url = queryString ? `${API_BASE}/items?${queryString}` : `${API_BASE}/items`;
  console.log("FETCHING PRODUCTS URL:", url);
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load showroom inventory (${response.status})`);
  }
  return response.json();
};

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await fetch(`${API_BASE}/categories`);
  if (!response.ok) {
    throw new Error(`Failed to load categories (${response.status})`);
  }
  return response.json();
};

export const fetchAvailableFilters = async (categoryId?: number): Promise<{ brands: string[], materials: string[], finishes: string[], sizes: string[] }> => {
  const url = categoryId ? `${API_BASE}/filters?categoryId=${categoryId}` : `${API_BASE}/filters`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load available filters (${response.status})`);
  }
  return response.json();
};

export const fetchProductDetails = async (id: number): Promise<UnifiedItem> => {
  const response = await fetch(`${API_BASE}/items/${id}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load product details (${response.status})`);
  }
  return response.json();
};
