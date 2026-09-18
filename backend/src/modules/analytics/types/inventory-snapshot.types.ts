export type StockHealthStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'HEALTHY';

export type ThresholdSource = 'ospos_reorder_level' | 'tilevista_threshold' | 'global_fallback';

/**
 * Point-in-time snapshot of inventory health for a catalog item at the showroom location.
 */
export interface InventorySnapshot {
  itemId: number;
  sku: string;
  name: string;
  category: string;
  categoryId: number | null;
  brand: string | null;
  color: string | null;
  material: string | null;
  
  /**
   * Live physical stock quantity at location 1 (Weerawila Showroom).
   */
  currentStock: number;

  /**
   * OSPOS operational reorder benchmark (SSOT).
   */
  reorderLevel: number;

  /**
   * Resolved 3-tier threshold applied for alerting.
   */
  effectiveThreshold: number;

  /**
   * Origin of the effective threshold.
   */
  thresholdSource: ThresholdSource;

  /**
   * Baseline inventory classification:
   * - OUT_OF_STOCK: currentStock <= 0
   * - LOW_STOCK: currentStock <= effectiveThreshold
   * - HEALTHY: currentStock > effectiveThreshold
   */
  stockStatus: StockHealthStatus;

  /**
   * Unit retail selling price.
   */
  unitPrice: number;

  /**
   * Estimated inventory valuation at retail price = currentStock * unitPrice.
   */
  estimatedStockValue: number;
}
