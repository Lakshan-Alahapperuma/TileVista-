import { IsOptional, IsString, IsIn, IsInt, Min, Max, Matches, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IntervalEnum, GroupByEnum } from '../types/analytics-enums';

export class DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  endDate?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month' = 'day';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AnalyticsTrendQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsEnum(IntervalEnum)
  interval?: IntervalEnum = IntervalEnum.DAILY;
}

export class AnalyticsPerformanceQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsEnum(GroupByEnum)
  groupBy?: GroupByEnum = GroupByEnum.PRODUCT;
}
