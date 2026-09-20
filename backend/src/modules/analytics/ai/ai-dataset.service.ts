import { Injectable, Logger } from '@nestjs/common';
import { ShowroomDataService } from '../showroom/showroom-data.service';
import { SaleItem } from '../types';
import {
  MlFeatureRow,
  MlDatasetMetadata,
  MlDatasetResponse,
} from './types/ai-dataset.types';

/**
 * Canonical constants for the AI dataset pipeline.
 * These define the exact boundaries of the training/evaluation window.
 */
const CANONICAL_START = '2026-02-21';
const CANONICAL_END = '2026-08-20';
const WARMUP_DAYS = 90;
const PREDICTION_HORIZON = 30;

// Chronological Validation Design (Multiple Forecast Origins)
// 1. We use a 3-fold rolling test origin split for robust evaluation.
// 2. Train origins are safely isolated from test origins to prevent target leakage.
const TRAIN_ORIGIN_START = '2026-05-22';
const TRAIN_ORIGIN_END = '2026-06-12';
// Test origins spaced by 5 days
const TEST_ORIGIN_DATES = ['2026-07-12', '2026-07-17', '2026-07-22'];

@Injectable()
export class AiDatasetService {
  private readonly logger = new Logger(AiDatasetService.name);

  constructor(private readonly showroomData: ShowroomDataService) {}

  /**
   * Generates the complete ML-ready dataset for 30-day demand prediction.
   */
  async generateDataset(): Promise<MlDatasetResponse> {
    this.logger.log('Starting AI dataset generation...');

    // 1. Fetch ALL sale items within the canonical window
    const allItems = await this.showroomData.getNormalizedSaleItems(
      CANONICAL_START,
      CANONICAL_END,
    );

    // 2. Build daily sales lookup
    const dailySales = this.buildDailySalesLookup(allItems);

    // 3. Extract product catalog
    const productCatalog = this.extractProductCatalog(allItems);

    // 4. Determine all unique categories and brands for one-hot encoding
    const allCategories = [...new Set(productCatalog.map(p => p.category))].sort();
    const allBrands = [...new Set(productCatalog.map(p => p.brand).filter(Boolean))].sort() as string[];

    // 5. Generate forecast origin dates
    const trainDates = this.generateDateRange(TRAIN_ORIGIN_START, TRAIN_ORIGIN_END);
    const testDates = TEST_ORIGIN_DATES;
    const allOriginDates = [...trainDates, ...testDates];

    // 6. Generate feature rows
    const rows: MlFeatureRow[] = [];

    for (const product of productCatalog) {
      const productDailySales = dailySales.get(product.itemId) || new Map();

      for (const originDate of allOriginDates) {
        const split: 'train' | 'test' = testDates.includes(originDate) ? 'test' : 'train';

        const row = this.computeFeatureRow(
          product,
          originDate,
          split,
          productDailySales,
          allCategories,
          allBrands,
        );

        rows.push(row);
      }
    }

    // 7. Leakage validation
    const leakageCheck = this.validateNoLeakage(rows);

    // 8. Compile feature column names
    const featureColumns = this.getFeatureColumnNames(allCategories, allBrands);

    // 9. Build metadata
    const trainRows = rows.filter(r => r.split === 'train');
    const testRows = rows.filter(r => r.split === 'test');

    const metadata: MlDatasetMetadata = {
      totalRows: rows.length,
      productCount: productCatalog.length,
      firstForecastOriginDate: allOriginDates[0],
      lastForecastOriginDate: allOriginDates[allOriginDates.length - 1],
      trainRows: trainRows.length,
      testRows: testRows.length,
      testOrigins: TEST_ORIGIN_DATES,
      featureColumns,
      targetColumn: 'target_next_30d_units_sold',
      canonicalWindow: { start: CANONICAL_START, end: CANONICAL_END },
      predictionHorizonDays: PREDICTION_HORIZON,
      warmupDays: WARMUP_DAYS,
      leakageCheck,
    };

    return {
      metadata,
      sampleRows: rows.slice(0, 10),
      data: rows,
    };
  }

  // -- Private Helpers --------------------------------------------------

  private buildDailySalesLookup(
    items: SaleItem[],
  ): Map<number, Map<string, { netUnits: number; priceSum: number; priceCount: number; discountSum: number; discountCount: number }>> {
    const lookup = new Map<number, Map<string, { netUnits: number; priceSum: number; priceCount: number; discountSum: number; discountCount: number }>>();

    for (const item of items) {
      const dateStr = item.saleTime.substring(0, 10);

      if (!lookup.has(item.itemId)) {
        lookup.set(item.itemId, new Map());
      }
      const productMap = lookup.get(item.itemId)!;

      const existing = productMap.get(dateStr) || {
        netUnits: 0,
        priceSum: 0,
        priceCount: 0,
        discountSum: 0,
        discountCount: 0,
      };

      existing.netUnits += item.quantityPurchased;
      if (item.quantityPurchased > 0) {
        existing.priceSum += item.itemUnitPrice;
        existing.priceCount += 1;
        let discountPct = 0;
        if (item.discountType === 0) {
          discountPct = item.discount;
        } else if (item.discountType === 1 && item.itemUnitPrice > 0) {
          discountPct = (item.discount / item.itemUnitPrice) * 100;
        }
        existing.discountSum += discountPct;
        existing.discountCount += 1;
      }

      productMap.set(dateStr, existing);
    }

    return lookup;
  }

  private extractProductCatalog(
    items: SaleItem[],
  ): { itemId: number; name: string; category: string; brand: string | null }[] {
    const seen = new Map<number, { itemId: number; name: string; category: string; brand: string | null }>();

    for (const item of items) {
      if (!seen.has(item.itemId)) {
        seen.set(item.itemId, {
          itemId: item.itemId,
          name: item.itemName,
          category: item.category,
          brand: item.brand,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.itemId - b.itemId);
  }

  private generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start + 'T00:00:00Z');
    const endDate = new Date(end + 'T00:00:00Z');

    while (current <= endDate) {
      dates.push(current.toISOString().substring(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * Computes all features and the target for a single (product, forecastOriginDate) pair.
   * Features strictly use data from T-1 and backwards.
   * Target strictly uses data from T to T+29.
   */
  private computeFeatureRow(
    product: { itemId: number; name: string; category: string; brand: string | null },
    originDate: string,
    split: 'train' | 'test',
    productDailySales: Map<string, { netUnits: number; priceSum: number; priceCount: number; discountSum: number; discountCount: number }>,
    allCategories: string[],
    allBrands: string[],
  ): MlFeatureRow {
    const originDateObj = new Date(originDate + 'T00:00:00Z');

    // -- Historical demand features (looking backward from T-1) --
    const sales7d = this.sumNetUnitsHistorical(productDailySales, originDate, 7);
    const sales30d = this.sumNetUnitsHistorical(productDailySales, originDate, 30);
    const sales90d = this.sumNetUnitsHistorical(productDailySales, originDate, 90);

    // -- Demand variability (looking backward from T-1, for 30 days) --
    const last30dDaily = this.getDailyNetUnitsArrayHistorical(productDailySales, originDate, 30);
    const demandStd30d = this.standardDeviation(last30dDaily);
    const zeroSalesDays30d = last30dDaily.filter(v => v === 0).length;

    // -- Advanced Lags and Rolling Features (from T-1) --
    // We already have last30dDaily from index 0 (T-1) backwards.
    // getDailyNetUnitsArrayHistorical returns [T-1, T-2, T-3, ... T-30]
    const salesLag1 = last30dDaily[0] || 0;
    const salesLag7 = last30dDaily[6] || 0;
    const salesLag14 = last30dDaily[13] || 0;
    const salesLag28 = last30dDaily[27] || 0;
    
    const last7dDaily = last30dDaily.slice(0, 7);
    const last14dDaily = last30dDaily.slice(0, 14);
    
    const rollingMean7d = sales7d / 7;
    const sales14d = last14dDaily.reduce((a, b) => a + b, 0);
    const rollingMean14d = sales14d / 14;
    const rollingMean30d = sales30d / 30;
    
    const rollingStd7d = this.standardDeviation(last7dDaily);
    const rollingStd14d = this.standardDeviation(last14dDaily);

    // -- Historical pricing & promotion (looking backward from T-1, for 30 days) --
    const { avgPrice, avgDiscountDepth } = this.getAvgPriceAndDiscountHistorical(productDailySales, originDate, 30);

    // -- Target: next 30 days net units (T to T+29) --
    const target = this.sumNetUnitsTarget(productDailySales, originDate, PREDICTION_HORIZON);

    // -- Temporal features at origin date (T) --
    const monthOfYear = originDateObj.getUTCMonth() + 1;
    const dayOfMonth = originDateObj.getUTCDate();
    const dayOfWeek = originDateObj.getUTCDay();
    const weekOfYear = this.getISOWeekNumber(originDateObj);

    // -- Output row mapping --
    const row: any = {
      productId: product.itemId,
      productName: product.name,
      forecastOriginDate: originDate,
      split,
      target_next_30d_units_sold: target,

      sales_last_7d: sales7d,
      sales_last_30d: sales30d,
      sales_last_90d: sales90d,

      demand_std_30d: Number(demandStd30d.toFixed(4)),
      zero_sales_days_last_30d: zeroSalesDays30d,
      
      sales_lag_1: salesLag1,
      sales_lag_7: salesLag7,
      sales_lag_14: salesLag14,
      sales_lag_28: salesLag28,
      
      rolling_mean_7d: Number(rollingMean7d.toFixed(4)),
      rolling_mean_14d: Number(rollingMean14d.toFixed(4)),
      rolling_mean_30d: Number(rollingMean30d.toFixed(4)),
      
      rolling_std_7d: Number(rollingStd7d.toFixed(4)),
      rolling_std_14d: Number(rollingStd14d.toFixed(4)),

      avg_selling_price_last_30d: Number(avgPrice.toFixed(2)),
      avg_discount_depth_last_30d: Number(avgDiscountDepth.toFixed(2)),

      month_of_year: monthOfYear,
      week_of_year: weekOfYear,
      day_of_month: dayOfMonth,
      day_of_week: dayOfWeek,
    };

    // Category one-hot
    for (const cat of allCategories) {
      const key = `category_${cat.replace(/\s+/g, '_')}`;
      row[key] = product.category === cat ? 1 : 0;
    }

    // Brand one-hot
    for (const brand of allBrands) {
      const key = `brand_${brand.replace(/\s+/g, '_')}`;
      row[key] = product.brand === brand ? 1 : 0;
    }

    return row as MlFeatureRow;
  }

  /**
   * Sums net units for a product over the N days ending on T-1.
   */
  private sumNetUnitsHistorical(
    productDailySales: Map<string, { netUnits: number }>,
    originDate: string,
    days: number,
  ): number {
    let total = 0;
    const tMinus1 = new Date(originDate + 'T00:00:00Z');
    tMinus1.setUTCDate(tMinus1.getUTCDate() - 1);

    for (let i = 0; i < days; i++) {
      const d = new Date(tMinus1);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const entry = productDailySales.get(dateStr);
      if (entry) total += entry.netUnits;
    }

    return total;
  }

  /**
   * Sums net units for the N days starting at T (T to T+29).
   * This is the target computation.
   */
  private sumNetUnitsTarget(
    productDailySales: Map<string, { netUnits: number }>,
    originDate: string, // T
    days: number, // 30
  ): number {
    let total = 0;
    const t = new Date(originDate + 'T00:00:00Z');

    for (let i = 0; i < days; i++) {
      const d = new Date(t);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().substring(0, 10);
      const entry = productDailySales.get(dateStr);
      if (entry) total += entry.netUnits;
    }

    return total;
  }

  /**
   * Returns an array of daily net units for the N days ending on T-1.
   */
  private getDailyNetUnitsArrayHistorical(
    productDailySales: Map<string, { netUnits: number }>,
    originDate: string,
    days: number,
  ): number[] {
    const result: number[] = [];
    const tMinus1 = new Date(originDate + 'T00:00:00Z');
    tMinus1.setUTCDate(tMinus1.getUTCDate() - 1);

    for (let i = 0; i < days; i++) {
      const d = new Date(tMinus1);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const entry = productDailySales.get(dateStr);
      result.push(entry ? entry.netUnits : 0);
    }

    return result;
  }

  /**
   * Computes average selling price and discount depth over the N days ending on T-1.
   */
  private getAvgPriceAndDiscountHistorical(
    productDailySales: Map<string, { priceSum: number; priceCount: number; discountSum: number; discountCount: number }>,
    originDate: string,
    days: number,
  ): { avgPrice: number; avgDiscountDepth: number } {
    let totalPriceSum = 0;
    let totalPriceCount = 0;
    let totalDiscountSum = 0;
    let totalDiscountCount = 0;

    const tMinus1 = new Date(originDate + 'T00:00:00Z');
    tMinus1.setUTCDate(tMinus1.getUTCDate() - 1);

    for (let i = 0; i < days; i++) {
      const d = new Date(tMinus1);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const entry = productDailySales.get(dateStr);
      if (entry) {
        totalPriceSum += entry.priceSum;
        totalPriceCount += entry.priceCount;
        totalDiscountSum += entry.discountSum;
        totalDiscountCount += entry.discountCount;
      }
    }

    return {
      avgPrice: totalPriceCount > 0 ? totalPriceSum / totalPriceCount : 0,
      avgDiscountDepth: totalDiscountCount > 0 ? totalDiscountSum / totalDiscountCount : 0,
    };
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private getISOWeekNumber(date: Date): number {
    const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private getFeatureColumnNames(allCategories: string[], allBrands: string[]): string[] {
    const columns = [
      'sales_last_7d',
      'sales_last_30d',
      'sales_last_90d',
      'demand_std_30d',
      'zero_sales_days_last_30d',
      'sales_lag_1',
      'sales_lag_7',
      'sales_lag_14',
      'sales_lag_28',
      'rolling_mean_7d',
      'rolling_mean_14d',
      'rolling_mean_30d',
      'rolling_std_7d',
      'rolling_std_14d',
      'avg_selling_price_last_30d',
      'avg_discount_depth_last_30d',
      'month_of_year',
      'week_of_year',
      'day_of_month',
      'day_of_week',
    ];

    for (const cat of allCategories) {
      columns.push(`category_${cat.replace(/\s+/g, '_')}`);
    }
    for (const brand of allBrands) {
      columns.push(`brand_${brand.replace(/\s+/g, '_')}`);
    }

    return columns;
  }

  /**
   * Validates that no future data leaked into any feature row.
   *
   * 1. Features strictly use T-1 and backwards.
   * 2. Target strictly uses T to T+29.
   * 3. The LAST training target MUST end before the FIRST test feature window starts,
   *    or at minimum must end before the FIRST test origin, to prevent target leakage.
   *    Since earliest test origin is 2026-07-12, the last train target ends 2026-07-11.
   *    No overlap.
   */
  private validateNoLeakage(rows: MlFeatureRow[]): { passed: boolean; details: string } {
    const issues: string[] = [];

    for (const row of rows) {
      const originDate = new Date(row.forecastOriginDate + 'T00:00:00Z');
      const warmupEnd = new Date(CANONICAL_START + 'T00:00:00Z');
      warmupEnd.setUTCDate(warmupEnd.getUTCDate() + WARMUP_DAYS);

      if (originDate < warmupEnd) {
        issues.push(`Row for product ${row.productId} on ${row.forecastOriginDate} is before warmup end.`);
      }

      // Check target window doesn't exceed canonical end
      const targetEnd = new Date(originDate);
      targetEnd.setUTCDate(targetEnd.getUTCDate() + PREDICTION_HORIZON - 1); // T + 29
      const canonEnd = new Date(CANONICAL_END + 'T00:00:00Z');
      if (targetEnd > canonEnd) {
        issues.push(`Row for product ${row.productId} on ${row.forecastOriginDate}: target window exceeds canonical end.`);
      }
    }

    // Check train target window doesn't overlap earliest test origin date
    const earliestTestOrigin = new Date(TEST_ORIGIN_DATES[0] + 'T00:00:00Z');
    const trainRows = rows.filter(r => r.split === 'train');
    for (const row of trainRows) {
      const targetEnd = new Date(row.forecastOriginDate + 'T00:00:00Z');
      targetEnd.setUTCDate(targetEnd.getUTCDate() + PREDICTION_HORIZON - 1); // T + 29

      if (targetEnd >= earliestTestOrigin) {
        issues.push(`Train target from origin ${row.forecastOriginDate} overlaps earliest test origin ${TEST_ORIGIN_DATES[0]}.`);
      }
    }

    if (issues.length === 0) {
      return { passed: true, details: 'No future data leakage detected. Target is strictly T to T+29. Train target is strictly isolated from test origin.' };
    } else {
      return { passed: false, details: `Found ${issues.length} leakage issue(s): ${issues.slice(0, 5).join('; ')}` };
    }
  }
}
