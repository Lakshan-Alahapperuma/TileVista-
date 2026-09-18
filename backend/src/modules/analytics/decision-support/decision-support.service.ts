import { Injectable, Logger } from '@nestjs/common';
import { ShowroomDataService } from '../showroom/showroom-data.service';
import { DemandProfilerService } from './demand-profiler.service';
import { DecisionRecommendation } from './types';

@Injectable()
export class DecisionSupportService {
  private readonly logger = new Logger(DecisionSupportService.name);

  constructor(
    private readonly showroomDataService: ShowroomDataService,
    private readonly demandProfiler: DemandProfilerService,
  ) {}

  /**
   * Generates actionable inventory and merchandising recommendations.
   * Uses the Baseline (sales_last_30d) as the forecast.
   * 
   * @param coverageMultiplier The desired multiplier for Restock Target. Default = 1 (cover 30 days).
   */
  async getRecommendations(coverageMultiplier: number = 1): Promise<DecisionRecommendation[]> {
    this.logger.log(`Generating decision support recommendations (coverageMultiplier=${coverageMultiplier})`);

    // 1. Get live inventory & thresholds
    const inventory = await this.showroomDataService.getInventorySnapshots();

    // 2. Get baseline 30-day forecast (sales_last_30d)
    // Using the last 30 days of the canonical window (2026-07-22 to 2026-08-20)
    const recentSales = await this.showroomDataService.getNormalizedSaleItems('2026-07-22', '2026-08-20');
    
    const forecastMap = new Map<number, number>();
    for (const sale of recentSales) {
      if (sale.quantityPurchased > 0) {
         const current = forecastMap.get(sale.itemId) || 0;
         forecastMap.set(sale.itemId, current + sale.quantityPurchased);
      }
    }

    // 3. Get exact ADI/CV2 canonical classifications
    const classMap = await this.demandProfiler.getCanonicalClassifications();

    const recommendations: DecisionRecommendation[] = [];

    // 4. Apply Business Rules
    for (const item of inventory) {
      const forecast30d = forecastMap.get(item.itemId) || 0;
      const demandClass = classMap.get(item.itemId)?.classification || 'Intermittent';
      const currentStock = item.currentStock;
      const effectiveThreshold = item.effectiveThreshold;

      let recType: DecisionRecommendation['recommendationType'] = 'STABLE_INVENTORY';
      let action = 'Stock is healthy. No action needed.';
      let priority: DecisionRecommendation['priority'] = 'NONE';
      let reason = 'Current stock and forecasted demand are balanced.';
      let trigger: DecisionRecommendation['trigger'] = 'NONE';

      // Evaluate CRITICAL_RESTOCK trigger conditions independently
      const belowReorder = currentStock <= effectiveThreshold;
      const forecastExceedsStock = currentStock < forecast30d;

      // Rule 1: CRITICAL_RESTOCK
      if (belowReorder || forecastExceedsStock) {
        recType = 'CRITICAL_RESTOCK';
        priority = 'HIGH';
        const targetStock = forecast30d * coverageMultiplier;
        const roq = Math.max(0, targetStock - currentStock);
        action = `Reorder immediately. Recommended Order Qty (ROQ) = ${roq}.`;

        if (belowReorder && forecastExceedsStock) {
          trigger = 'BOTH';
          reason = `Current stock is at or below the OSPOS reorder level and forecast demand exceeds current stock.`;
        } else if (belowReorder) {
          trigger = 'BELOW_REORDER_LEVEL';
          reason = `Current stock is at or below the OSPOS reorder level.`;
        } else {
          trigger = 'FORECAST_EXCEEDS_STOCK';
          reason = `Forecast demand exceeds the current available stock.`;
        }
      } 
      // Rule 2: OVERSTOCK_CLEARANCE
      else if (currentStock > (forecast30d * 6) && currentStock > 50) {
        recType = 'OVERSTOCK_CLEARANCE';
        priority = 'LOW';
        action = 'Consider promotion/discount to reduce holding costs.';
        reason = `Current stock (${currentStock}) exceeds 6 months of forecasted demand (${forecast30d * 6}) and volume is substantial (>50 units).`;
      }
      // Rule 3: LUMPY_WARNING
      else if (demandClass === 'Lumpy' && currentStock < (forecast30d * 2)) {
        recType = 'LUMPY_WARNING';
        priority = 'MEDIUM';
        action = 'Lumpy demand is prone to sudden spikes. Increase safety stock.';
        reason = `Product exhibits Lumpy demand (high variance) and current stock (${currentStock}) provides minimal safety buffer against sudden bulk orders.`;
      }

      recommendations.push({
        productId: item.itemId,
        productName: item.name,
        category: item.category,
        currentStock,
        forecast30d,
        demandClass,
        recommendationType: recType,
        recommendedAction: action,
        reason,
        priority,
        trigger,
      });
    }

    // Sort: High -> Medium -> Low -> None
    const priorityWeight = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'NONE': 0 };
    recommendations.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return recommendations;
  }
}
