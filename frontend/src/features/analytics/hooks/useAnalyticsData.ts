import { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../../../services/analytics.service';
import { SalesTrendPoint, ProductPerformance, ProductVelocity, DecisionRecommendation } from '../../../types/analytics';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface AnalyticsData {
  kpis: any | null;
  trends: SalesTrendPoint[];
  performance: ProductPerformance[];
  velocity: ProductVelocity[];
  inventory: any | null;
  recommendations: DecisionRecommendation[];
}

export interface SectionStatus {
  isLoading: boolean;
  error: string | null;
}

export const useAnalyticsData = (dateRange?: DateRange) => {
  const [data, setData] = useState<AnalyticsData>({
    kpis: null,
    trends: [],
    performance: [],
    velocity: [],
    inventory: null,
    recommendations: [],
  });

  const [status, setStatus] = useState({
    kpis: { isLoading: true, error: null } as SectionStatus,
    trends: { isLoading: true, error: null } as SectionStatus,
    performance: { isLoading: true, error: null } as SectionStatus,
    inventory: { isLoading: true, error: null } as SectionStatus,
    recommendations: { isLoading: true, error: null } as SectionStatus,
  });

  const fetchSection = useCallback(async (
    key: keyof typeof status,
    fetchFn: () => Promise<any>,
    dataKey: keyof AnalyticsData | (keyof AnalyticsData)[],
    mounted: { current: boolean }
  ) => {
    setStatus(prev => ({ ...prev, [key]: { isLoading: true, error: null } }));
    try {
      const result = await fetchFn();
      if (!mounted.current) return;
      
      setData(prev => {
        if (Array.isArray(dataKey)) {
          const newData = { ...prev };
          dataKey.forEach((k, idx) => {
            newData[k] = result[idx];
          });
          return newData;
        } else {
          return { ...prev, [dataKey]: result };
        }
      });
      setStatus(prev => ({ ...prev, [key]: { isLoading: false, error: null } }));
    } catch (err: any) {
      if (!mounted.current) return;
      setStatus(prev => ({ ...prev, [key]: { isLoading: false, error: err.message || `Failed to load ${key}` } }));
    }
  }, []);

  useEffect(() => {
    const mounted = { current: true };
    const { startDate, endDate } = dateRange || {};

    fetchSection('kpis', () => analyticsService.getKpis(startDate, endDate), 'kpis', mounted);
    fetchSection('trends', () => analyticsService.getTrends(startDate, endDate), 'trends', mounted);
    
    // Performance and velocity are needed together for the table
    fetchSection(
      'performance', 
      () => Promise.all([
        analyticsService.getPerformance(startDate, endDate),
        analyticsService.getVelocity(startDate, endDate)
      ]), 
      ['performance', 'velocity'], 
      mounted
    );

    // Inventory
    fetchSection('inventory', () => analyticsService.getInventory(), 'inventory', mounted);
    
    // Decision support doesn't typically take dates in this API design, but we fetch it independently
    fetchSection('recommendations', () => analyticsService.getDecisionSupportRecommendations(), 'recommendations', mounted);

    return () => { mounted.current = false; };
  }, [dateRange?.startDate, dateRange?.endDate, fetchSection]);

  return { data, status };
};


