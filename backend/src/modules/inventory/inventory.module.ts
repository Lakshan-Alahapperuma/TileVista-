import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { OsposIntegrationModule } from '../integrations/ospos/ospos.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [OsposIntegrationModule, NotificationsModule],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}

