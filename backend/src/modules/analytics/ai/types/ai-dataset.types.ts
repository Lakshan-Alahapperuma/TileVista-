/**
 * AI Dataset Types for 30-Day Product Demand Prediction
 *
 * One row = one Product on one Forecast Origin Date.
 * 
 * FORECAST ORIGIN CONVENTION:
 * If the Forecast Origin Date is T:
 * - Historical features use data from T-1 and earlier (strictly out-of-sample).
 * - Target uses the next 30 days starting precisely at T (T to T+29).
 */

/**
 * A single ML-ready feature row for demand prediction.
 */
export interface MlFeatureRow {
  // -- Identity (not model features, used for traceability) --
  /** OSPOS item_id */
  productId: number;
  /** Human-readable product name */
  productName: string;
  /** The forecast origin date (T) (YYYY-MM-DD) */
  forecastOriginDate: string;
  /** Whether this row belongs to the train or test split */
  split: 'train' | 'test';

  // -- Target (Y) --
  /** Net units sold in the 30 days starting from T (T to T+29) */
  target_next_30d_units_sold: number;

  // -- Historical Demand Features --
  /** Net units sold in the 7 days ending on T-1 */
  sales_last_7d: number;
  /** Net units sold in the 30 days ending on T-1 */
  sales_last_30d: number;
  /** Net units sold in the 90 days ending on T-1 */
  sales_last_90d: number;

  // -- Demand Variability Features --
  /** Standard deviation of daily net units over the 30 days ending on T-1 */
  demand_std_30d: number;
  /** Number of zero-sales days out of the 30 days ending on T-1 */
  zero_sales_days_last_30d: number;

  // -- Advanced Lags and Rolling Features --
  /** Net units sold on exactly T-1 */
  sales_lag_1: number;
  /** Net units sold on exactly T-7 */
  sales_lag_7: number;
  /** Net units sold on exactly T-14 */
  sales_lag_14: number;
  /** Net units sold on exactly T-28 */
  sales_lag_28: number;
  
  /** Daily average sales over the 7 days ending on T-1 */
  rolling_mean_7d: number;
  /** Daily average sales over the 14 days ending on T-1 */
  rolling_mean_14d: number;
  /** Daily average sales over the 30 days ending on T-1 */
  rolling_mean_30d: number;
  
  /** Standard deviation of daily net units over the 7 days ending on T-1 */
  rolling_std_7d: number;
  /** Standard deviation of daily net units over the 14 days ending on T-1 */
  rolling_std_14d: number;

  // -- Historical Pricing & Promotion Features --
  /** Average selling price over the 30 days ending on T-1 (0 if no sales) */
  avg_selling_price_last_30d: number;
  /** Average discount depth (%) over the 30 days ending on T-1 (0 if no sales) */
  avg_discount_depth_last_30d: number;

  // -- Temporal Features --
  /** Month of year at origin date T (1-12) */
  month_of_year: number;
  /** ISO week of year at origin date T (1-53) */
  week_of_year: number;
  /** Day of month at origin date T (1-31) */
  day_of_month: number;
  /** Day of week at origin date T (0=Sunday, 6=Saturday) */
  day_of_week: number;

  // -- Categorical Features (one-hot encoded) --
  /** Dynamic one-hot columns: category_Tiles, category_WashBasins, etc. */
  [key: `category_${string}`]: number;
  /** Dynamic one-hot columns: brand_Rocell, brand_Lanka, etc. */
  [key: `brand_${string}`]: number;
}

/**
 * Metadata about the generated ML dataset.
 */
export interface MlDatasetMetadata {
  /** Total number of feature rows generated */
  totalRows: number;
  /** Number of distinct products represented */
  productCount: number;
  /** Earliest forecast origin date in the dataset */
  firstForecastOriginDate: string;
  /** Latest forecast origin date in the dataset */
  lastForecastOriginDate: string;
  /** Number of training rows */
  trainRows: number;
  /** Number of test rows */
  testRows: number;
  /** List of multiple test origin dates used for chronological validation */
  testOrigins: string[];
  /** List of all feature column names (excluding identity/target) */
  featureColumns: string[];
  /** The target column name */
  targetColumn: string;
  /** Canonical data window used */
  canonicalWindow: { start: string; end: string };
  /** Prediction horizon in days */
  predictionHorizonDays: number;
  /** Warm-up period in days (features require this much history before origin) */
  warmupDays: number;
  /** Leakage validation result */
  leakageCheck: {
    passed: boolean;
    details: string;
  };
}

/**
 * Complete AI dataset response including data and metadata.
 */
export interface MlDatasetResponse {
  metadata: MlDatasetMetadata;
  /** Sample rows for inspection (first 10) */
  sampleRows: MlFeatureRow[];
  /** Full dataset (all rows) */
  data: MlFeatureRow[];
}
