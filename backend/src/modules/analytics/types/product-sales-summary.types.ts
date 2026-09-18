/**
 * Historical product-level sales performance summary over a specified time window.
 */
export interface ProductSalesSummary {
  itemId: number;
  sku: string;
  name: string;
  category: string;
  categoryId: number | null;
  brand: string | null;
  color: string | null;
  material: string | null;
  
  /**
   * Net positive units sold (excluding returns).
   */
  unitsSold: number;

  /**
   * Total units returned during this period.
   */
  unitsReturned: number;

  /**
   * Net units = unitsSold - unitsReturned.
   */
  netUnitsSold: number;

  /**
   * Total gross revenue collected for this product (customer payment baseline).
   */
  grossRevenue: number;

  /**
   * Total tax collected for this product.
   */
  taxAmount: number;

  /**
   * Net revenue = grossRevenue - taxAmount.
   */
  netRevenue: number;

  /**
   * Total cost of goods sold = netUnitsSold * averageCostPrice.
   */
  totalCost: number;

  /**
   * Gross profit = netRevenue - totalCost.
   */
  grossProfit: number;

  /**
   * Profit margin percentage = (grossProfit / netRevenue) * 100.
   */
  profitMarginPercent: number;

  /**
   * Number of distinct sales transactions containing this product.
   */
  transactionCount: number;

  /**
   * Average unit selling price across transactions.
   */
  averageSellingPrice: number;

  /**
   * Current live stock at location 1 (Weerawila Showroom).
   */
  currentStock: number;

  /**
   * OSPOS operational reorder benchmark (SSOT).
   */
  reorderLevel: number;

  /**
   * Date of the first recorded sale in the requested window.
   */
  firstSaleDate: string | null;

  /**
   * Date of the most recent sale in the requested window.
   */
  lastSaleDate: string | null;
}
