import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OsposIntegrationModule } from '../integrations/ospos/ospos.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [OsposIntegrationModule, NotificationsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
