// --- USER TYPES ---
export type UserRole = 'ADMIN' | 'CUSTOMER' | 'GUEST';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: Date;
}

// --- PRODUCT TYPES ---
export type ProductCategory = 'TILE' | 'BATHWARE' | 'ACCESSORY';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  discount: number; // percentage
  quantity: number;
  category: ProductCategory;
  imageUrl?: string;
  brand: string;
  color?: string;
  material?: string;
  size?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- CART & ORDERS TYPES ---
export interface CartItem {
  osposItemId: number;
  quantity: number;
  lineTotal: number;
  isAvailable: boolean;
  item: any; // We can type this as UnifiedItem or OSPOSItem later, using any for now to bypass strict old Product type
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  priceAtPurchase: number;
}

export interface Order {
  id: string;
  userId?: string;
  user?: User;
  status: OrderStatus;
  total: number;
  tax: number;
  discount: number;
  items: OrderItem[];
  shippingAddress: string;
  paymentMethod: string;
  createdAt: Date;
}

// --- PACKAGES TYPES ---
export interface ProductPackage {
  id: string;
  name: string;
  description?: string;
  discountPercent: number;
  price: number;
  products: Product[];
  imageUrl?: string;
  createdAt: Date;
}

// --- DESIGNER TYPES ---
export type BathroomShape = 'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE';

export interface WallDesign {
  wallIndex: number;
  color?: string;
  tileProductId?: string;
  tileProduct?: Product;
  coverageHeight?: number;
}

export interface ItemPlacement {
  id: string;
  productId: string;
  product: Product;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface BathroomLayout {
  id: string;
  userId?: string;
  name: string;
  shape: BathroomShape;
  width: number;
  length: number;
  height: number;
  wallDesigns: WallDesign[];
  placements: ItemPlacement[];
  createdAt: Date;
  updatedAt: Date;
}

// --- POS LOG TYPES ---
export interface POSSyncLog {
  id: string;
  sku: string;
  quantitySynced: number;
  action: 'SALE' | 'RESTOCK' | 'SYNC';
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  timestamp: Date;
}

// --- ANALYTICS TYPES ---
export interface ProductPerformance {
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  unitsSold: number;
  revenue: number;
  currentStock: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface AnalyticsReport {
  totalRevenue: number;
  totalOrders: number;
  fastMovingItems: ProductPerformance[];
  slowMovingItems: ProductPerformance[];
  salesTrends: SalesTrend[];
  restockAlertsCount: number;
}

// --- 3D MODEL GENERATION TYPES ---
export type ModelGenerationStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'EXTRACTING_FRAMES'
  | 'RECONSTRUCTING'
  | 'GENERATING_MESH'
  | 'TEXTURING'
  | 'EXPORTING_GLB'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ModelInputType = 'VIDEO' | 'IMAGES';

export interface ModelGenerationProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  inputType: ModelInputType;
  status: ModelGenerationStatus;
  progress: number;
  currentStep?: string;
  inputVideoPath?: string;
  outputGlbPath?: string;
  thumbnailPath?: string;
  errorMessage?: string;
  fileSize?: string;
  processingStartedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  images?: ModelGenerationImage[];
  modelUrl?: string;
}

export interface ModelGenerationImage {
  id: string;
  projectId: string;
  filePath: string;
  originalName?: string;
  orderNumber?: number;
  createdAt: Date;
}
