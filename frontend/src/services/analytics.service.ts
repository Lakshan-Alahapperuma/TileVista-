import { AnalyticsKpi, SalesTrendPoint, ProductPerformance, ProductVelocity, DecisionRecommendation } from '../types/analytics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tilevista_admin_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithAuth(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }
  return response.json();
}

export const analyticsService = {
  async getKpis(startDate?: string, endDate?: string): Promise<AnalyticsKpi> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetchWithAuth(`/admin/analytics/kpis?${params.toString()}`);
  },

  async getTrends(startDate?: string, endDate?: string): Promise<SalesTrendPoint[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetchWithAuth(`/admin/analytics/trends?${params.toString()}`);
    const items = Array.isArray(res) ? res : res?.data || [];
    return items.map((item: any) => ({
      date: item.date,
      revenue: item.netRevenue ?? item.grossRevenue ?? item.revenue ?? 0,
      grossRevenue: item.grossRevenue ?? 0,
      netRevenue: item.netRevenue ?? 0,
      netUnitsSold: item.netUnitsSold ?? 0,
      orderCount: item.netUnitsSold ?? 0,
      profit: item.profit ?? 0,
    }));
  },

  async getPerformance(startDate?: string, endDate?: string): Promise<ProductPerformance[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetchWithAuth(`/admin/analytics/performance?${params.toString()}`);
    const items = Array.isArray(res) ? res : res?.data || [];
    return items.map((item: any) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      unitsSold: item.netUnitsSold ?? item.unitsSold ?? 0,
      netUnitsSold: item.netUnitsSold ?? item.unitsSold ?? 0,
      revenue: item.netRevenue ?? item.revenue ?? 0,
      netRevenue: item.netRevenue ?? item.revenue ?? 0,
      profit: item.profit ?? 0,
      currentStock: item.currentStock ?? 0,
    }));
  },

  async getVelocity(startDate?: string, endDate?: string): Promise<ProductVelocity[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetchWithAuth(`/admin/analytics/velocity?${params.toString()}`);
    const items = Array.isArray(res) ? res : res?.data || [];
    return items.map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      brand: item.brand,
      netUnitsSold: item.netUnitsSold ?? 0,
      averageDailySales: item.averageDailySales ?? 0,
      velocityClass: item.classification || item.velocityClass || 'NORMAL',
      classification: item.classification,
    }));
  },

  async getInventory(): Promise<any> {
    return fetchWithAuth(`/admin/analytics/inventory`);
  },

  async getDecisionSupportRecommendations(): Promise<DecisionRecommendation[]> {
    const res = await fetchWithAuth(`/admin/analytics/decision-support/recommendations`);
    return Array.isArray(res) ? res : res?.data || [];
  }
};

