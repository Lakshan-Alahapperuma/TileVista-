import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShowroomDataService } from './showroom/showroom-data.service';
import { DataLayerSummaryDto } from './dto/data-layer-summary.dto';
import { IntervalEnum, GroupByEnum } from './types/analytics-enums';
import { KpiResponseDto, TrendResponseDto, PerformanceResponseDto, VelocityResponseDto, InventoryResponseDto, TrendPointDto, PerformanceItemDto, VelocityItemDto } from './dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly showroomDataService: ShowroomDataService,
  ) {}

  /**
   * Diagnostic summary endpoint for verifying the analytics data layer.
   */
  async getDataLayerSummary(startDate?: string, endDate?: string): Promise<DataLayerSummaryDto> {
    return this.showroomDataService.getDataLayerSummary(startDate, endDate);
  }

  /**
   * Admin dashboard overview combining online orders and OSPOS showroom inventory data.
   */
  async getAdminDashboardStats() {
    // 1. Online TileVista Orders Aggregate
    const salesAggregate = await this.prisma.orders.aggregate({
      _sum: { total_amount: true },
      _count: { order_id: true },
    });

    const totalRevenue = Number(salesAggregate._sum.total_amount || 0);
    const totalOrders = salesAggregate._count.order_id || 0;

    // 2. Online Fast-moving items
    const orderItems = await this.prisma.order_items.groupBy({
      by: ['ospos_item_id'],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    // 3. Live Showroom Inventory via ShowroomDataService
    const inventorySnapshots = await this.showroomDataService.getInventorySnapshots();
    const inventoryMap = new Map(inventorySnapshots.map((s) => [s.itemId, s]));

    const fastMovingItems = orderItems
      .map((item) => {
        const snapshot = inventoryMap.get(item.ospos_item_id);
        if (!snapshot) return null;
        return {
          osposItemId: item.ospos_item_id,
          itemName: snapshot.name,
          sku: snapshot.sku,
          category: snapshot.category,
          unitsSold: item._sum.quantity || 0,
          revenue: Number(Number(item._sum.subtotal || 0).toFixed(2)),
          currentStock: snapshot.currentStock,
        };
      })
      .filter(Boolean);

    // 4. Showroom Restock Alerts using 3-tier threshold SSOT
    const restockAlerts = inventorySnapshots
      .filter((s) => s.stockStatus === 'LOW_STOCK' || s.stockStatus === 'OUT_OF_STOCK')
      .map((s) => ({
        osposItemId: s.itemId,
        name: s.name,
        sku: s.sku,
        category: s.category,
        currentStock: s.currentStock,
        effectiveThreshold: s.effectiveThreshold,
        source: s.thresholdSource,
      }));

    // 5. Online sales trends
    const orders = await this.prisma.orders.findMany({
      select: { created_at: true, total_amount: true },
      orderBy: { created_at: 'asc' },
    });

    const salesTrendMap = new Map<string, { revenue: number; orderCount: number }>();
    orders.forEach((o) => {
      const dateStr = (o.created_at || new Date()).toISOString().split('T')[0];
      const revenueVal = Number(o.total_amount);
      const existing = salesTrendMap.get(dateStr) || { revenue: 0, orderCount: 0 };
      salesTrendMap.set(dateStr, {
        revenue: existing.revenue + revenueVal,
        orderCount: existing.orderCount + 1,
      });
    });

    const salesTrends = Array.from(salesTrendMap.entries()).map(([date, data]) => ({
      date,
      revenue: Number(data.revenue.toFixed(2)),
      orderCount: data.orderCount,
    }));

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      fastMovingItems,
      slowMovingItems: [],
      salesTrends,
      restockAlertsCount: restockAlerts.length,
      restockAlerts,
    };
  }

  // ── Showroom Sales Data Provider Delegates ────────────────────────────

  /**
   * Fetches showroom revenue grouped by brand attribute (EAV-sourced).
   */
  async getRevenueByBrand(startDate?: string, endDate?: string) {
    const summaries = await this.showroomDataService.getProductSalesSummaries(startDate, endDate);
    const brandMap = new Map<string, { revenue: number; unitsSold: number; productCount: number }>();

    for (const item of summaries) {
      const brand = item.brand || 'Unbranded';
      const existing = brandMap.get(brand) || { revenue: 0, unitsSold: 0, productCount: 0 };
      brandMap.set(brand, {
        revenue: Number((existing.revenue + item.grossRevenue).toFixed(2)),
        unitsSold: existing.unitsSold + item.unitsSold,
        productCount: existing.productCount + 1,
      });
    }

    return Array.from(brandMap.entries())
      .map(([brand, data]) => ({ brand, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Fetches showroom revenue grouped by category.
   */
  async getRevenueByCategory(startDate?: string, endDate?: string) {
    const summaries = await this.showroomDataService.getProductSalesSummaries(startDate, endDate);
    const categoryMap = new Map<string, { revenue: number; unitsSold: number; productCount: number }>();

    for (const item of summaries) {
      const category = item.category || 'Uncategorized';
      const existing = categoryMap.get(category) || { revenue: 0, unitsSold: 0, productCount: 0 };
      categoryMap.set(category, {
        revenue: Number((existing.revenue + item.grossRevenue).toFixed(2)),
        unitsSold: existing.unitsSold + item.unitsSold,
        productCount: existing.productCount + 1,
      });
    }

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Fetches top-selling items from the showroom POS.
   */
  async getTopSellingItems(startDate?: string, endDate?: string, limit = 10) {
    const summaries = await this.showroomDataService.getProductSalesSummaries(startDate, endDate);
    return summaries.slice(0, limit);
  }

  // ── Part 2: Descriptive Analytics Engine Methods ────────────────────────────

  async getOverviewKPIs(startDate?: string, endDate?: string): Promise<KpiResponseDto> {
    const lineItems = await this.showroomDataService.getNormalizedSaleItems(startDate, endDate);
    const sales = await this.showroomDataService.getNormalizedSales(startDate, endDate);
    
    let totalGrossRevenue = 0;
    let totalTaxAmount = 0;
    let totalCogs = 0;
    let netUnitsSold = 0;
    
    for (const item of lineItems) {
      totalGrossRevenue += item.grossRevenue;
      totalTaxAmount += item.taxAmount;
      totalCogs += item.cogs;
      
      if (item.quantityPurchased > 0) {
        netUnitsSold += item.quantityPurchased;
      } else {
        netUnitsSold -= Math.abs(item.quantityPurchased);
      }
    }
    
    const totalNetRevenue = totalGrossRevenue - totalTaxAmount;
    const totalProfit = totalNetRevenue - totalCogs;
    const totalTransactions = sales.length;
    const averageTransactionValue = totalTransactions > 0 ? totalNetRevenue / totalTransactions : 0;
    
    return {
      totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
      totalNetRevenue: Number(totalNetRevenue.toFixed(2)),
      netUnitsSold,
      totalTransactions,
      averageTransactionValue: Number(averageTransactionValue.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
    };
  }

  private formatPeriod(dateStr: string, interval: IntervalEnum): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr.substring(0, 10);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (interval === IntervalEnum.MONTHLY) return `${year}-${month}`;
    if (interval === IntervalEnum.WEEKLY) {
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }
    return `${year}-${month}-${day}`;
  }

  async getSalesTrends(startDate?: string, endDate?: string, interval: IntervalEnum = IntervalEnum.DAILY): Promise<TrendResponseDto> {
    const lineItems = await this.showroomDataService.getNormalizedSaleItems(startDate, endDate);
    const bucketMap = new Map<string, TrendPointDto>();
    
    for (const item of lineItems) {
      const period = this.formatPeriod(item.saleTime, interval);
      const existing = bucketMap.get(period) || {
        date: period,
        grossRevenue: 0,
        netRevenue: 0,
        netUnitsSold: 0,
        profit: 0
      };
      
      existing.grossRevenue += item.grossRevenue;
      existing.netRevenue += item.netRevenue;
      existing.profit += (item.netRevenue - item.cogs);
      
      if (item.quantityPurchased > 0) {
        existing.netUnitsSold += item.quantityPurchased;
      } else {
        existing.netUnitsSold -= Math.abs(item.quantityPurchased);
      }
      
      bucketMap.set(period, existing);
    }
    
    const data = Array.from(bucketMap.values())
      .map(d => ({
        date: d.date,
        grossRevenue: Number(d.grossRevenue.toFixed(2)),
        netRevenue: Number(d.netRevenue.toFixed(2)),
        netUnitsSold: d.netUnitsSold,
        profit: Number(d.profit.toFixed(2))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
      
    return { interval, data };
  }

  async getPerformanceMetrics(startDate?: string, endDate?: string, groupBy: GroupByEnum = GroupByEnum.PRODUCT): Promise<PerformanceResponseDto> {
    const summaries = await this.showroomDataService.getProductSalesSummaries(startDate, endDate);
    const map = new Map<string, PerformanceItemDto>();
    
    for (const s of summaries) {
      let key = s.name;
      if (groupBy === GroupByEnum.BRAND) key = s.brand || 'Unbranded';
      if (groupBy === GroupByEnum.CATEGORY) key = s.category || 'Uncategorized';
      
      const existing = map.get(key) || { 
        itemId: s.itemId, 
        name: key, 
        category: s.category || 'Uncategorized', 
        netRevenue: 0, 
        netUnitsSold: 0, 
        profit: 0 
      };
      existing.netRevenue += s.netRevenue;
      existing.netUnitsSold += s.netUnitsSold;
      existing.profit += s.grossProfit;
      
      map.set(key, existing);
    }
    
    const data = Array.from(map.values())
      .map(d => ({
        itemId: d.itemId,
        name: d.name,
        category: d.category,
        netRevenue: Number(d.netRevenue.toFixed(2)),
        netUnitsSold: d.netUnitsSold,
        profit: Number(d.profit.toFixed(2))
      }))
      .sort((a, b) => b.netRevenue - a.netRevenue);
      
    return { groupBy, data };
  }

  async getProductVelocityClassification(startDate?: string, endDate?: string): Promise<VelocityResponseDto> {
    const summaries = await this.showroomDataService.getProductSalesSummaries(startDate, endDate);
    
    let start = startDate ? new Date(startDate) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    let end = endDate ? new Date(endDate) : new Date();
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
    
    // Group by category
    const categoryMap = new Map<string, typeof summaries>();
    for (const s of summaries) {
      const cat = s.category || 'Uncategorized';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat).push(s);
    }
    
    const velocityData: VelocityItemDto[] = [];
    
    for (const [cat, items] of categoryMap.entries()) {
      // Sort items in category by netUnitsSold
      items.sort((a, b) => b.netUnitsSold - a.netUnitsSold);
      
      const totalItems = items.length;
      const top20Index = Math.max(1, Math.ceil(totalItems * 0.2));
      const bottom20Index = Math.max(0, Math.floor(totalItems * 0.8));
      
      items.forEach((item, index) => {
        const averageDailySales = item.netUnitsSold / days;
        let classification: 'FAST_MOVING' | 'NORMAL' | 'SLOW_MOVING' = 'NORMAL';
        
        if (item.netUnitsSold <= 0) {
          classification = 'SLOW_MOVING';
        } else if (index < top20Index) {
          classification = 'FAST_MOVING';
        } else if (index >= bottom20Index) {
          classification = 'SLOW_MOVING';
        }
        
        velocityData.push({
          productId: item.itemId,
          productName: item.name,
          category: cat,
          brand: item.brand || 'Unbranded',
          netUnitsSold: item.netUnitsSold,
          averageDailySales: Number(averageDailySales.toFixed(4)),
          classification
        });
      });
    }
    
    velocityData.sort((a, b) => b.netUnitsSold - a.netUnitsSold);
    
    return { analysisPeriodDays: days, data: velocityData };
  }

  async getInventoryAnalytics(): Promise<InventoryResponseDto> {
    const snapshots = await this.showroomDataService.getInventorySnapshots();
    
    let totalCurrentStock = 0;
    let itemsAtOrBelowReorderLevel = 0;
    let outOfStockItems = 0;
    let totalStockValue = 0;
    
    for (const s of snapshots) {
      totalCurrentStock += s.currentStock;
      totalStockValue += s.estimatedStockValue;
      if (s.stockStatus === 'OUT_OF_STOCK') outOfStockItems++;
      if (s.stockStatus === 'LOW_STOCK' || s.stockStatus === 'OUT_OF_STOCK') itemsAtOrBelowReorderLevel++;
    }
    
    return {
      totalCurrentStock,
      itemsAtOrBelowReorderLevel,
      outOfStockItems,
      totalStockValue: Number(totalStockValue.toFixed(2))
    };
  }
}
