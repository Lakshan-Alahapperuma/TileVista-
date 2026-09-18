/**
 * Time-bucketed sales aggregate point (daily, weekly, or monthly).
 */
export interface SalesTrendPoint {
  /**
   * Time bucket identifier (e.g. '2026-08-19' for day, '2026-W33' for week, '2026-08' for month).
   */
  period: string;

  /**
   * Gross revenue collected during this interval.
   */
  grossRevenue: number;

  /**
   * Tax collected during this interval.
   */
  taxAmount: number;

  /**
   * Net revenue = grossRevenue - taxAmount.
   */
  netRevenue: number;

  /**
   * Total units sold during this interval.
   */
  unitsSold: number;

  /**
   * Total units returned during this interval.
   */
  unitsReturned: number;

  /**
   * Number of distinct sales transactions in this period.
   */
  transactionCount: number;

  /**
   * Average order value (grossRevenue / transactionCount).
   */
  averageOrderValue: number;
}
