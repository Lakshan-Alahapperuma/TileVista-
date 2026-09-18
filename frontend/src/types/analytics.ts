export interface AnalyticsKpi {
  totalGrossRevenue?: number;
  totalNetRevenue?: number;
  netUnitsSold?: number;
  totalTransactions?: number;
  averageTransactionValue?: number;
  totalProfit?: number;
  totalRevenue?: number;
  totalOrders?: number;
  activeProducts?: number;
  label?: string;
  value?: string | number;
  icon?: string;
  trend?: number;
}

export interface SalesTrendPoint {
  date: string;
  grossRevenue?: number;
  netRevenue?: number;
  revenue?: number;
  netUnitsSold?: number;
  orderCount?: number;
  profit?: number;
}

export interface ProductPerformance {
  itemId?: number;
  name: string;
  category?: string;
  unitsSold?: number;
  netUnitsSold?: number;
  revenue?: number;
  netRevenue?: number;
  currentStock?: number;
  profit?: number;
  velocityClass?: string;
}

export interface ProductVelocity {
  productId?: number;
  productName?: string;
  category?: string;
  brand?: string;
  netUnitsSold?: number;
  averageDailySales?: number;
  velocityClass?: string;
  classification?: 'FAST_MOVING' | 'NORMAL' | 'SLOW_MOVING' | string;
}

export interface DecisionRecommendation {
  productId: number;
  productName: string;
  category: string;
  currentStock: number;
  forecast30d: number;
  demandClass: string;
  recommendationType: 'CRITICAL_RESTOCK' | 'LUMPY_WARNING' | 'OVERSTOCK_CLEARANCE' | 'STABLE_INVENTORY';
  recommendedAction: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  trigger: 'BELOW_REORDER_LEVEL' | 'FORECAST_EXCEEDS_STOCK' | 'BOTH' | 'NONE';
}


