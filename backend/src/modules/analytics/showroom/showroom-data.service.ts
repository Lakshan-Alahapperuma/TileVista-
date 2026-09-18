import { Injectable, Logger } from '@nestjs/common';
import { OsposIntegrationService, OsposSaleItem } from '../../integrations/ospos/ospos.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { config } from '../../../config';
import {
  DataQualityMetadata,
  InventorySnapshot,
  ProductSalesSummary,
  Sale,
  SaleItem,
  SalesTrendPoint,
  StockHealthStatus,
  ThresholdSource,
} from '../types';
import { DataLayerSummaryDto } from '../dto/data-layer-summary.dto';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

/**
 * ShowroomDataService
 * 
 * Single authoritative backend data provider for showroom sales and inventory.
 * Extracts, paginates, normalizes, and aggregates data from OSPOS and TileVista
 * to provide strongly typed domain models for analytics and future AI modules.
 */
@Injectable()
export class ShowroomDataService {
  private readonly logger = new Logger(ShowroomDataService.name);

  // Short-lived 30-second in-memory cache to deduplicate rapid consecutive calls
  private readonly CACHE_TTL_MS = 30 * 1000;
  private readonly salesCache = new Map<string, CacheEntry<OsposSaleItem[]>>();
  private inventoryCache: CacheEntry<InventorySnapshot[]> | null = null;

  constructor(
    private readonly osposService: OsposIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Clears the in-memory cache.
   */
  clearCache(): void {
    this.salesCache.clear();
    this.inventoryCache = null;
    this.logger.debug('Showroom data cache cleared.');
  }

  /**
   * Fetches ALL sales line items for a date range from OSPOS,
   * automatically traversing all pagination pages if multiple pages exist.
   */
  async fetchAllRawSales(
    startDate?: string,
    endDate?: string,
    locationId = 1,
  ): Promise<OsposSaleItem[]> {
    const start = startDate || this.getDefaultStartDate();
    const end = endDate || this.getDefaultEndDate();
    const cacheKey = `${start}_${end}_${locationId}`;

    const cached = this.salesCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      this.logger.debug(`Returning cached raw sales for [${cacheKey}] (${cached.data.length} lines)`);
      return cached.data;
    }

    this.logger.log(`Fetching complete sales dataset from OSPOS for ${start} to ${end} (location ${locationId})...`);

    const allLines: OsposSaleItem[] = [];
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 200; // Max supported by OSPOS API endpoint

    do {
      const response = await this.osposService.fetchSalesData({
        startDate: start,
        endDate: end,
        page: currentPage,
        limit: pageSize,
        locationId,
      });

      if (response && response.data && response.data.length > 0) {
        allLines.push(...response.data);
        totalPages = response.pagination?.totalPages || 1;
        currentPage++;
      } else {
        break;
      }
    } while (currentPage <= totalPages);

    this.logger.log(`Successfully retrieved all ${allLines.length} line items across ${totalPages} page(s).`);

    this.salesCache.set(cacheKey, {
      data: allLines,
      cachedAt: Date.now(),
    });

    return allLines;
  }

  /**
   * Returns a flat array of normalized SaleItem objects with explicit
   * grossRevenue, netRevenue, taxAmount, and grossProfit calculations.
   */
  async getNormalizedSaleItems(
    startDate?: string,
    endDate?: string,
    locationId = 1,
  ): Promise<SaleItem[]> {
    const rawItems = await this.fetchAllRawSales(startDate, endDate, locationId);

    return rawItems.map((raw) => {
      const isReturn = raw.quantity_purchased < 0;
      const grossRevenue = Number(raw.line_total || 0);
      const taxAmount = Number(raw.tax_amount || 0);
      const netRevenue = Number((grossRevenue - taxAmount).toFixed(2));
      const cogs = Number((raw.quantity_purchased * raw.item_cost_price).toFixed(2));
      const grossProfit = Number((netRevenue - cogs).toFixed(2));

      return {
        saleId: raw.sale_id,
        itemId: raw.item_id,
        line: raw.line,
        itemName: raw.item_name,
        sku: raw.sku,
        category: raw.category || 'Uncategorized',
        categoryId: raw.category_id,
        quantityPurchased: Number(raw.quantity_purchased),
        itemCostPrice: Number(raw.item_cost_price),
        itemUnitPrice: Number(raw.item_unit_price),
        discount: Number(raw.discount),
        discountType: raw.discount_type,
        grossRevenue,
        taxAmount,
        netRevenue,
        cogs,
        grossProfit,
        currentStock: Number(raw.current_stock),
        reorderLevel: Number(raw.reorder_level),
        brand: raw.brand || null,
        color: raw.color || null,
        material: raw.material || null,
        saleTime: raw.sale_time,
        saleType: raw.sale_type,
        isReturn,
      };
    });
  }

  /**
   * Returns structured Sale transaction objects, grouping line items by transaction header.
   */
  async getNormalizedSales(
    startDate?: string,
    endDate?: string,
    locationId = 1,
  ): Promise<Sale[]> {
    const lineItems = await this.getNormalizedSaleItems(startDate, endDate, locationId);
    const saleMap = new Map<number, Sale>();

    for (const item of lineItems) {
      const existing = saleMap.get(item.saleId);
      if (existing) {
        existing.grossRevenue = Number((existing.grossRevenue + item.grossRevenue).toFixed(2));
        existing.taxAmount = Number((existing.taxAmount + item.taxAmount).toFixed(4));
        existing.netRevenue = Number((existing.netRevenue + item.netRevenue).toFixed(2));
        existing.totalUnits = Number((existing.totalUnits + item.quantityPurchased).toFixed(3));
        existing.lineCount += 1;
        existing.items.push(item);
        if (!item.isReturn) existing.isReturn = false;
      } else {
        saleMap.set(item.saleId, {
          saleId: item.saleId,
          saleTime: item.saleTime,
          saleType: item.saleType,
          customerId: null,
          employeeId: 1,
          invoiceNumber: null,
          grossRevenue: item.grossRevenue,
          taxAmount: item.taxAmount,
          netRevenue: item.netRevenue,
          totalUnits: item.quantityPurchased,
          lineCount: 1,
          items: [item],
          isReturn: item.isReturn,
        });
      }
    }

    return Array.from(saleMap.values()).sort(
      (a, b) => new Date(b.saleTime).getTime() - new Date(a.saleTime).getTime(),
    );
  }

  /**
   * Aggregates sales by product over the specified date range.
   */
  async getProductSalesSummaries(
    startDate?: string,
    endDate?: string,
    locationId = 1,
  ): Promise<ProductSalesSummary[]> {
    const lineItems = await this.getNormalizedSaleItems(startDate, endDate, locationId);
    const productMap = new Map<number, {
      itemId: number;
      sku: string;
      name: string;
      category: string;
      categoryId: number | null;
      brand: string | null;
      color: string | null;
      material: string | null;
      unitsSold: number;
      unitsReturned: number;
      grossRevenue: number;
      taxAmount: number;
      totalCost: number;
      transactionIds: Set<number>;
      priceSum: number;
      priceCount: number;
      currentStock: number;
      reorderLevel: number;
      firstSaleDate: string | null;
      lastSaleDate: string | null;
    }>();

    for (const item of lineItems) {
      let entry = productMap.get(item.itemId);
      if (!entry) {
        entry = {
          itemId: item.itemId,
          sku: item.sku,
          name: item.itemName,
          category: item.category,
          categoryId: item.categoryId,
          brand: item.brand,
          color: item.color,
          material: item.material,
          unitsSold: 0,
          unitsReturned: 0,
          grossRevenue: 0,
          taxAmount: 0,
          totalCost: 0,
          transactionIds: new Set<number>(),
          priceSum: 0,
          priceCount: 0,
          currentStock: item.currentStock,
          reorderLevel: item.reorderLevel,
          firstSaleDate: item.saleTime,
          lastSaleDate: item.saleTime,
        };
        productMap.set(item.itemId, entry);
      }

      if (item.quantityPurchased > 0) {
        entry.unitsSold += item.quantityPurchased;
      } else {
        entry.unitsReturned += Math.abs(item.quantityPurchased);
      }

      entry.grossRevenue += item.grossRevenue;
      entry.taxAmount += item.taxAmount;
      entry.totalCost += item.cogs;
      entry.transactionIds.add(item.saleId);
      entry.priceSum += item.itemUnitPrice;
      entry.priceCount++;

      // Update date bounds
      if (!entry.firstSaleDate || item.saleTime < entry.firstSaleDate) {
        entry.firstSaleDate = item.saleTime;
      }
      if (!entry.lastSaleDate || item.saleTime > entry.lastSaleDate) {
        entry.lastSaleDate = item.saleTime;
      }
    }

    return Array.from(productMap.values()).map((p) => {
      const netUnitsSold = p.unitsSold - p.unitsReturned;
      const grossRevenue = Number(p.grossRevenue.toFixed(2));
      const taxAmount = Number(p.taxAmount.toFixed(4));
      const netRevenue = Number((grossRevenue - taxAmount).toFixed(2));
      const totalCost = Number(p.totalCost.toFixed(2));
      const grossProfit = Number((netRevenue - totalCost).toFixed(2));
      const profitMarginPercent = netRevenue > 0
        ? Number(((grossProfit / netRevenue) * 100).toFixed(2))
        : 0;
      const averageSellingPrice = p.priceCount > 0
        ? Number((p.priceSum / p.priceCount).toFixed(2))
        : 0;

      return {
        itemId: p.itemId,
        sku: p.sku,
        name: p.name,
        category: p.category,
        categoryId: p.categoryId,
        brand: p.brand,
        color: p.color,
        material: p.material,
        unitsSold: p.unitsSold,
        unitsReturned: p.unitsReturned,
        netUnitsSold,
        grossRevenue,
        taxAmount,
        netRevenue,
        totalCost,
        grossProfit,
        profitMarginPercent,
        transactionCount: p.transactionIds.size,
        averageSellingPrice,
        currentStock: p.currentStock,
        reorderLevel: p.reorderLevel,
        firstSaleDate: p.firstSaleDate,
        lastSaleDate: p.lastSaleDate,
      };
    }).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }

  /**
   * Retrieves live inventory snapshots across all catalog products,
   * resolving 3-tier threshold priority (OSPOS reorder_level SSOT) and baseline status.
   */
  async getInventorySnapshots(): Promise<InventorySnapshot[]> {
    if (this.inventoryCache && Date.now() - this.inventoryCache.cachedAt < this.CACHE_TTL_MS) {
      return this.inventoryCache.data;
    }

    const [allOsposItems, productThresholdMap] = await Promise.all([
      this.osposService.fetchAllItems(),
      this.getProductThresholdMap(),
    ]);

    const snapshots: InventorySnapshot[] = allOsposItems.map((item) => {
      const currentStock = Number(item.quantity || 0);
      const reorderLevel = Number(item.reorder_level || 0);
      const onlineThreshold = productThresholdMap.get(item.item_id);

      let effectiveThreshold = config.lowStockThreshold;
      let thresholdSource: ThresholdSource = 'global_fallback';

      // 3-tier resolution: OSPOS reorder_level (primary) → TileVista online threshold → global fallback
      if (reorderLevel > 0) {
        effectiveThreshold = reorderLevel;
        thresholdSource = 'ospos_reorder_level';
      } else if (onlineThreshold !== undefined) {
        effectiveThreshold = onlineThreshold;
        thresholdSource = 'tilevista_threshold';
      }

      // Baseline status classification for Part 1
      let stockStatus: StockHealthStatus = 'HEALTHY';
      if (currentStock <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (currentStock <= effectiveThreshold) {
        stockStatus = 'LOW_STOCK';
      }

      const unitPrice = Number(item.price || 0);
      const estimatedStockValue = Number((currentStock * unitPrice).toFixed(2));

      return {
        itemId: item.item_id,
        sku: item.sku,
        name: item.name,
        category: item.category || 'Uncategorized',
        categoryId: item.category_id,
        brand: item.brand || null,
        color: item.color || null,
        material: item.material || null,
        currentStock,
        reorderLevel,
        effectiveThreshold,
        thresholdSource,
        stockStatus,
        unitPrice,
        estimatedStockValue,
      };
    });

    this.inventoryCache = {
      data: snapshots,
      cachedAt: Date.now(),
    };

    return snapshots;
  }

  /**
   * Generates time-series trend points bucketed by day, week, or month.
   */
  async getTimeSeriesTrends(
    startDate?: string,
    endDate?: string,
    granularity: 'day' | 'week' | 'month' = 'day',
    locationId = 1,
  ): Promise<SalesTrendPoint[]> {
    const lineItems = await this.getNormalizedSaleItems(startDate, endDate, locationId);
    const bucketMap = new Map<string, {
      grossRevenue: number;
      taxAmount: number;
      unitsSold: number;
      unitsReturned: number;
      transactions: Set<number>;
    }>();

    for (const item of lineItems) {
      const period = this.formatPeriodKey(item.saleTime, granularity);
      const existing = bucketMap.get(period) || {
        grossRevenue: 0,
        taxAmount: 0,
        unitsSold: 0,
        unitsReturned: 0,
        transactions: new Set<number>(),
      };

      existing.grossRevenue += item.grossRevenue;
      existing.taxAmount += item.taxAmount;
      if (item.quantityPurchased > 0) {
        existing.unitsSold += item.quantityPurchased;
      } else {
        existing.unitsReturned += Math.abs(item.quantityPurchased);
      }
      existing.transactions.add(item.saleId);

      bucketMap.set(period, existing);
    }

    return Array.from(bucketMap.entries())
      .map(([period, data]) => {
        const grossRevenue = Number(data.grossRevenue.toFixed(2));
        const taxAmount = Number(data.taxAmount.toFixed(4));
        const netRevenue = Number((grossRevenue - taxAmount).toFixed(2));
        const transactionCount = data.transactions.size;
        const averageOrderValue = transactionCount > 0
          ? Number((grossRevenue / transactionCount).toFixed(2))
          : 0;

        return {
          period,
          grossRevenue,
          taxAmount,
          netRevenue,
          unitsSold: data.unitsSold,
          unitsReturned: data.unitsReturned,
          transactionCount,
          averageOrderValue,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Generates data-quality and provenance metadata for the requested sales dataset.
   */
  async getDataQualityReport(
    startDate?: string,
    endDate?: string,
    locationId = 1,
  ): Promise<DataQualityMetadata> {
    const rawItems = await this.fetchAllRawSales(startDate, endDate, locationId);
    const uniqueSales = new Set<number>();
    let missingBrandCount = 0;
    let missingCategoryCount = 0;
    let returnedUnitsCount = 0;
    let returnedLinesCount = 0;
    let hasMockSales = false;

    for (const item of rawItems) {
      uniqueSales.add(item.sale_id);
      if (item.sale_id >= 10000) hasMockSales = true;
      if (!item.brand) missingBrandCount++;
      if (!item.category || item.category === 'Unknown') missingCategoryCount++;
      if (item.quantity_purchased < 0) {
        returnedUnitsCount += Math.abs(item.quantity_purchased);
        returnedLinesCount++;
      }
    }

    return {
      totalSalesCount: uniqueSales.size,
      totalLineItemsCount: rawItems.length,
      dateRange: {
        start: startDate || this.getDefaultStartDate(),
        end: endDate || this.getDefaultEndDate(),
      },
      missingBrandCount,
      missingCategoryCount,
      returnedUnitsCount,
      returnedLinesCount,
      source: 'OSPOS',
      isMockData: hasMockSales,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Compiles the comprehensive diagnostic payload answering all 8 core questions.
   */
  async getDataLayerSummary(startDate?: string, endDate?: string): Promise<DataLayerSummaryDto> {
    const [sales, lineItems, productSummaries, inventorySnapshots, trends, dataQuality] =
      await Promise.all([
        this.getNormalizedSales(startDate, endDate),
        this.getNormalizedSaleItems(startDate, endDate),
        this.getProductSalesSummaries(startDate, endDate),
        this.getInventorySnapshots(),
        this.getTimeSeriesTrends(startDate, endDate, 'month'),
        this.getDataQualityReport(startDate, endDate),
      ]);

    const totalGrossRevenue = lineItems.reduce((sum, item) => sum + item.grossRevenue, 0);
    const totalTaxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalNetRevenue = totalGrossRevenue - totalTaxAmount;
    const totalUnitsSold = lineItems.filter((i) => i.quantityPurchased > 0).reduce((sum, i) => sum + i.quantityPurchased, 0);
    const totalUnitsReturned = lineItems.filter((i) => i.quantityPurchased < 0).reduce((sum, i) => sum + Math.abs(i.quantityPurchased), 0);

    const outOfStockCount = inventorySnapshots.filter((i) => i.stockStatus === 'OUT_OF_STOCK').length;
    const lowStockCount = inventorySnapshots.filter((i) => i.stockStatus === 'LOW_STOCK').length;
    const healthyStockCount = inventorySnapshots.filter((i) => i.stockStatus === 'HEALTHY').length;
    const totalStockUnits = inventorySnapshots.reduce((sum, i) => sum + i.currentStock, 0);
    const totalEstimatedValuation = inventorySnapshots.reduce((sum, i) => sum + i.estimatedStockValue, 0);

    // Verify all 8 core questions can be answered
    const eightQuestionsChecklist = {
      whatWasSold: lineItems.length > 0 && !!lineItems[0].itemName && !!lineItems[0].sku,
      whenWasItSold: lineItems.length > 0 && !!lineItems[0].saleTime,
      howMuchWasSold: lineItems.length > 0 && lineItems[0].quantityPurchased !== undefined && lineItems[0].grossRevenue !== undefined,
      whichProduct: lineItems.length > 0 && lineItems[0].itemId > 0,
      whichCategory: lineItems.length > 0 && !!lineItems[0].category,
      whichBrand: lineItems.some((i) => !!i.brand),
      whatIsCurrentStock: inventorySnapshots.length > 0 && inventorySnapshots[0].currentStock !== undefined,
      whatIsReorderLevel: inventorySnapshots.length > 0 && inventorySnapshots[0].reorderLevel !== undefined,
    };

    return {
      status: 'healthy',
      message: 'Analytics data layer operational and connected to OSPOS.',
      dataQuality,
      totals: {
        grossRevenue: Number(totalGrossRevenue.toFixed(2)),
        taxAmount: Number(totalTaxAmount.toFixed(4)),
        netRevenue: Number(totalNetRevenue.toFixed(2)),
        unitsSold: totalUnitsSold,
        unitsReturned: totalUnitsReturned,
        transactionCount: sales.length,
        lineItemCount: lineItems.length,
        averageTransactionValue: sales.length > 0
          ? Number((totalGrossRevenue / sales.length).toFixed(2))
          : 0,
      },
      inventoryOverview: {
        totalCatalogItems: inventorySnapshots.length,
        outOfStockCount,
        lowStockCount,
        healthyStockCount,
        totalStockUnits,
        totalEstimatedValuation: Number(totalEstimatedValuation.toFixed(2)),
      },
      sampleTransactions: sales.slice(0, 3),
      sampleProductSummaries: productSummaries.slice(0, 5),
      sampleInventorySnapshots: inventorySnapshots.slice(0, 5),
      sampleTrends: trends,
      eightQuestionsChecklist,
    };
  }

  // ── Private Utility Helpers ──────────────────────────────────────────

  private async getProductThresholdMap(): Promise<Map<number, number>> {
    const thresholds = await this.prisma.stock_thresholds.findMany({
      include: { products: { select: { ospos_item_id: true } } },
    });

    const map = new Map<number, number>();
    for (const t of thresholds) {
      if (t.products?.ospos_item_id) {
        map.set(t.products.ospos_item_id, t.threshold_value);
      }
    }
    return map;
  }

  private formatPeriodKey(dateTimeStr: string, granularity: 'day' | 'week' | 'month'): string {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr.substring(0, 10);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (granularity === 'month') {
      return `${year}-${month}`;
    }

    if (granularity === 'week') {
      // Calculate ISO week number
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }

    return `${year}-${month}-${day}`;
  }

  private getDefaultStartDate(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
