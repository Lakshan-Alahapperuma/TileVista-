export class VelocityItemDto {
  productId: number;
  productName: string;
  category: string;
  brand: string;
  netUnitsSold: number;
  averageDailySales: number;
  classification: 'FAST_MOVING' | 'NORMAL' | 'SLOW_MOVING';
}

export class VelocityResponseDto {
  analysisPeriodDays: number;
  data: VelocityItemDto[];
}
