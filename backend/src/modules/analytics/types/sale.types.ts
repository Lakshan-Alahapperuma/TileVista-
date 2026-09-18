/**
 * Sale line item structure representing an individual product sold in a transaction.
 */
export interface SaleItem {
  saleId: number;
  itemId: number;
  line: number;
  itemName: string;
  sku: string;
  category: string;
  categoryId: number | null;
  quantityPurchased: number;
  itemCostPrice: number;
  itemUnitPrice: number;
  discount: number;
  discountType: number; // 0 = PERCENT, 1 = FIXED per-unit
  
  /**
   * Gross revenue collected for this line after discount (customer payment baseline).
   */
  grossRevenue: number;

  /**
   * Tax amount included in or applied to this line item.
   */
  taxAmount: number;

  /**
   * Net revenue = grossRevenue - taxAmount (tax-exclusive revenue baseline).
   */
  netRevenue: number;

  /**
   * Cost of goods sold for this line = quantityPurchased * itemCostPrice.
   */
  cogs: number;

  /**
   * Gross profit = netRevenue - cogs.
   */
  grossProfit: number;

  currentStock: number;
  reorderLevel: number;
  brand: string | null;
  color: string | null;
  material: string | null;
  saleTime: string;
  saleType: number; // 0=POS, 1=Invoice, 2=Work Order, 3=Quote, 4=Return
  isReturn: boolean;
}

/**
 * Complete Sale transaction header aggregating one or more SaleItems.
 */
export interface Sale {
  saleId: number;
  saleTime: string;
  saleType: number;
  customerId: number | null;
  employeeId: number;
  invoiceNumber: string | null;
  
  /**
   * Sum of line-level gross revenues (total charged to customer).
   */
  grossRevenue: number;

  /**
   * Sum of line-level tax amounts.
   */
  taxAmount: number;

  /**
   * Sum of line-level net revenues (grossRevenue - taxAmount).
   */
  netRevenue: number;

  /**
   * Total units sold across all lines (can be negative if pure return).
   */
  totalUnits: number;

  /**
   * Number of distinct product lines in the transaction.
   */
  lineCount: number;

  /**
   * Array of individual line items within this transaction.
   */
  items: SaleItem[];

  /**
   * Whether this entire transaction is a return.
   */
  isReturn: boolean;
}
