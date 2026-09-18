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
