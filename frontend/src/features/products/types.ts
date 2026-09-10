export interface UnifiedItem {
  itemId: number;
  name: string;
  category: string;
  categoryId: number | null;
  subcategoryId: number | null;
  sku: string;
  description: string | null;
  price: number;
  quantity: number;
  imageUrl: string | null;
  glbUrl: string | null;
  scale: { x: number; y: number; z: number };
  rotationY: number;
  tags: string[];
  brand?: string | null;
  material: string | null;
  finish: string | null;
  size?: string | null;
  dimensions?: { width: number; height: number; depth: number; unit: string } | null;
  isEnabled: boolean;
}

export interface Subcategory {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  subcategories: Subcategory[];
}
