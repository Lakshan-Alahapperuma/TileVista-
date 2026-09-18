/**
 * Metadata detailing the quality, provenance, completeness, and integrity of the fetched sales dataset.
 */
export interface DataQualityMetadata {
  /**
   * Total number of distinct sales transactions retrieved.
   */
  totalSalesCount: number;

  /**
   * Total number of individual line items retrieved across all transactions.
   */
  totalLineItemsCount: number;

  /**
   * Start and end dates of the requested window.
   */
  dateRange: {
    start: string;
    end: string;
  };

  /**
   * Count of line items where the dynamic EAV 'Brand' attribute was null or unassigned.
   */
  missingBrandCount: number;

  /**
   * Count of line items where the Category was null or unassigned.
   */
  missingCategoryCount: number;

  /**
   * Total return units detected (negative purchased quantities).
   */
  returnedUnitsCount: number;

  /**
   * Total return line items detected.
   */
  returnedLinesCount: number;

  /**
   * Data source identifier.
   */
  source: 'OSPOS';

  /**
   * Flag indicating whether the dataset contains synthetic mock records (e.g. sale_id >= 10000).
   */
  isMockData: boolean;

  /**
   * Timestamp when the dataset was extracted and normalized.
   */
  extractedAt: string;
}
