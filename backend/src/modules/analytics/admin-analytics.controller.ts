import { Controller, Get, Query, UseGuards, ParseFloatPipe, DefaultValuePipe } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AiDatasetService } from './ai/ai-dataset.service';
import { DecisionSupportService } from './decision-support/decision-support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnalyticsTrendQueryDto, AnalyticsPerformanceQueryDto, DateRangeQueryDto } from './dto/analytics-query.dto';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly aiDatasetService: AiDatasetService,
    private readonly decisionSupportService: DecisionSupportService,
  ) {}

  @Get('kpis')
  async getKpis(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOverviewKPIs(query.startDate, query.endDate);
  }

  @Get('trends')
  async getTrends(@Query() query: AnalyticsTrendQueryDto) {
    return this.analyticsService.getSalesTrends(query.startDate, query.endDate, query.interval);
  }

  @Get('performance')
  async getPerformance(@Query() query: AnalyticsPerformanceQueryDto) {
    return this.analyticsService.getPerformanceMetrics(query.startDate, query.endDate, query.groupBy);
  }

  @Get('velocity')
  async getVelocity(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getProductVelocityClassification(query.startDate, query.endDate);
  }

  @Get('inventory')
  async getInventory() {
    return this.analyticsService.getInventoryAnalytics();
  }

  @Get('ai/dataset')
  async getAiDataset() {
    return this.aiDatasetService.generateDataset();
  }

  @Get('decision-support/recommendations')
  async getDecisionSupportRecommendations(
    @Query('coverageMultiplier', new DefaultValuePipe(1), ParseFloatPipe) coverageMultiplier: number,
  ) {
    return this.decisionSupportService.getRecommendations(coverageMultiplier);
  }
}

