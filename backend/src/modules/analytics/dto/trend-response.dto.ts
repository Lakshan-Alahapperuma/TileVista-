export class TrendPointDto {
  date: string;
  grossRevenue: number;
  netRevenue: number;
  netUnitsSold: number;
  profit: number;
}

export class TrendResponseDto {
  interval: string;
  data: TrendPointDto[];
}
