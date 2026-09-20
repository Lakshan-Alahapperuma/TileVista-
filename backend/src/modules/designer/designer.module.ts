import { Module } from '@nestjs/common';
import { DesignerService } from './services/designer.service';
import { DesignerController } from './controllers/designer.controller';
import { DesignerRepository } from './repositories/designer.repository';

@Module({
  providers: [DesignerService, DesignerRepository],
  controllers: [DesignerController],
  exports: [DesignerService],
})
export class DesignerModule {}
