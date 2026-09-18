import {
  DataQualityMetadata,
  InventorySnapshot,
  ProductSalesSummary,
  Sale,
  SalesTrendPoint,
} from '../types';

/**
 * Diagnostic response structure validating that the data layer successfully
 * answers all 8 essential analytics questions and provides dataset quality metrics.
 */
export interface DataLayerSummaryDto {
  status: 'healthy' | 'degraded' | 'unreachable';
  message: string;
  dataQuality: DataQualityMetadata;
  totals: {
    grossRevenue: number;
    taxAmount: number;
    netRevenue: number;
    unitsSold: number;
    unitsReturned: number;
    transactionCount: number;
    lineItemCount: number;
    averageTransactionValue: number;
  };
  inventoryOverview: {
    totalCatalogItems: number;
    outOfStockCount: number;
    lowStockCount: number;
    healthyStockCount: number;
    totalStockUnits: number;
    totalEstimatedValuation: number;
  };
  sampleTransactions: Sale[];
  sampleProductSummaries: ProductSalesSummary[];
  sampleInventorySnapshots: InventorySnapshot[];
  sampleTrends: SalesTrendPoint[];
  eightQuestionsChecklist: {
    whatWasSold: boolean;
    whenWasItSold: boolean;
    howMuchWasSold: boolean;
    whichProduct: boolean;
    whichCategory: boolean;
    whichBrand: boolean;
    whatIsCurrentStock: boolean;
    whatIsReorderLevel: boolean;
  };
}
