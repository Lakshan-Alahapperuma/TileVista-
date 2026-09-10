import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import { PackageController } from './package.controller';
import { PackageRepository } from './package.repository';
import { OsposIntegrationModule } from '../integrations/ospos/ospos.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, OsposIntegrationModule],
  providers: [PackageService, PackageRepository],
  controllers: [PackageController],
  exports: [PackageService, PackageRepository],
})
export class PackageModule {}
