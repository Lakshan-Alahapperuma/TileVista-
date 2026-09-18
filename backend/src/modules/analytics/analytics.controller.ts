import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DateRangeQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Diagnostic summary endpoint for Part 1: Analytics Data Layer.
   * Validates answering the 8 core analytics questions, data quality, and inventory health.
   */
  @Get('data-layer/summary')
  async getDataLayerSummary(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getDataLayerSummary(query.startDate, query.endDate);
  }

  /**
   * Admin dashboard overview statistics.
   */
  @Get('dashboard')
  async getDashboardStats() {
    return this.analyticsService.getAdminDashboardStats();
  }
}
