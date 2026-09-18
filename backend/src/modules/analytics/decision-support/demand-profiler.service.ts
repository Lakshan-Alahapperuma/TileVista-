import { Injectable, Logger } from '@nestjs/common';
import { ShowroomDataService } from '../showroom/showroom-data.service';

const CANONICAL_START = '2026-02-21';
const CANONICAL_END = '2026-08-20';
const CANONICAL_DAYS = 181;

export interface DemandProfile {
  productId: number;
  adi: number;
  cv2: number;
  classification: 'Smooth' | 'Intermittent' | 'Erratic' | 'Lumpy';
}

@Injectable()
export class DemandProfilerService {
  private readonly logger = new Logger(DemandProfilerService.name);

  constructor(private readonly showroomDataService: ShowroomDataService) {}

  /**
   * Generates the canonical ADI/CV2 classification for all products.
   * Matches the exact methodology used in the profiling reports.
   */
  async getCanonicalClassifications(): Promise<Map<number, DemandProfile>> {
    const items = await this.showroomDataService.getNormalizedSaleItems(
      CANONICAL_START,
      CANONICAL_END,
    );

    // Map productId -> date string -> net units
    const salesByProduct = new Map<number, Map<string, number>>();

    for (const item of items) {
      if (!salesByProduct.has(item.itemId)) {
        salesByProduct.set(item.itemId, new Map());
      }
      const prodSales = salesByProduct.get(item.itemId)!;
      const dateStr = item.saleTime.substring(0, 10);
      
      const current = prodSales.get(dateStr) || 0;
      prodSales.set(dateStr, current + item.quantityPurchased);
    }

    const profiles = new Map<number, DemandProfile>();

    for (const [productId, dateMap] of salesByProduct.entries()) {
      // Filter to only days with positive net sales
      const positiveDays = Array.from(dateMap.values()).filter(qty => qty > 0);
      const daysWithSales = positiveDays.length;

      if (daysWithSales === 0) {
        profiles.set(productId, {
          productId,
          adi: CANONICAL_DAYS,
          cv2: 0,
          classification: 'Smooth', // Default for no sales
        });
        continue;
      }

      const totalUnits = positiveDays.reduce((a, b) => a + b, 0);
      const meanDemand = totalUnits / daysWithSales;

      let variance = 0;
      if (daysWithSales > 1) {
        variance = positiveDays.reduce((a, b) => a + Math.pow(b - meanDemand, 2), 0) / (daysWithSales - 1);
      }
      
      const stdDev = Math.sqrt(variance);
      
      const adi = CANONICAL_DAYS / daysWithSales;
      const cv2 = meanDemand > 0 ? Math.pow(stdDev / meanDemand, 2) : 0;

      let classification: 'Smooth' | 'Intermittent' | 'Erratic' | 'Lumpy';
      if (adi < 1.32 && cv2 < 0.49) classification = 'Smooth';
      else if (adi >= 1.32 && cv2 < 0.49) classification = 'Intermittent';
      else if (adi < 1.32 && cv2 >= 0.49) classification = 'Erratic';
      else classification = 'Lumpy'; // adi >= 1.32 && cv2 >= 0.49

      profiles.set(productId, {
        productId,
        adi: Number(adi.toFixed(4)),
        cv2: Number(cv2.toFixed(4)),
        classification,
      });
    }

    return profiles;
  }
}
