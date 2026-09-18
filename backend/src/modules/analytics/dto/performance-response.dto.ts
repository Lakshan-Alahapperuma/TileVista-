export class PerformanceItemDto {
  itemId?: number;
  name: string;
  category?: string;
  netRevenue: number;
  netUnitsSold: number;
  profit: number;
}

export class PerformanceResponseDto {
  groupBy: string;
  data: PerformanceItemDto[];
}

