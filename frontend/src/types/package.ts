export interface PackageItem {
  productId: string;
  osposItemId: number;
  quantity: number;
  name: string;
  price: number;
  category: string;
  sku: string;
  glbUrl?: string | null;
  imageUrl?: string | null;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  discountPercent: number;
  calculatedPrice: number;
  originalPrice: number;
  items: PackageItem[];
  designData?: any;
  status?: string;
  createdAt?: string;
}

export interface CreatePackagePayload {
  name: string;
  description?: string;
  discountPercent: number;
  coverImage?: string;
  designData?: any;
  packageItems: {
    productId?: string;
    osposItemId?: number;
    quantity: number;
  }[];
}
