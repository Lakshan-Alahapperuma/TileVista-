import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { ShowroomDataService } from './showroom/showroom-data.service';
import { AiDatasetService } from './ai/ai-dataset.service';
import { OsposIntegrationModule } from '../integrations/ospos/ospos.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { DemandProfilerService } from './decision-support/demand-profiler.service';
import { DecisionSupportService } from './decision-support/decision-support.service';

@Module({
  imports: [OsposIntegrationModule, PrismaModule],
  providers: [
    AnalyticsService,
    ShowroomDataService,
    AiDatasetService,
    DemandProfilerService,
    DecisionSupportService,
  ],
  controllers: [AnalyticsController, AdminAnalyticsController],
  exports: [AnalyticsService, ShowroomDataService, AiDatasetService],
})
export class AnalyticsModule {}
