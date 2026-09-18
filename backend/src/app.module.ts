import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PackageModule } from './modules/packages/package.module';
import { DesignerModule } from './modules/designer/designer.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { OsposIntegrationModule } from './modules/integrations/ospos/ospos.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { BullModule } from '@nestjs/bullmq';
import { ModelGeneratorModule } from './modules/model-generator/model-generator.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

const moduleImports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../.env'],
  }),
  ScheduleModule.forRoot(),
  PrismaModule,
  AuthModule,
  UsersModule,
  ProductsModule,
  InventoryModule,
  CartModule,
  OrdersModule,
  PackageModule,
  DesignerModule,
  AnalyticsModule,
  OsposIntegrationModule,
  InquiriesModule,
  NotificationsModule,
];

if (process.env.REDIS_AVAILABLE === 'true') {
  moduleImports.push(
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
  );
}

moduleImports.push(ModelGeneratorModule.register());

@Module({
  imports: moduleImports,
})
export class AppModule {}

