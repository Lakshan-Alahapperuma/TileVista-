import { Controller, Post, Get, Put, Body, Param } from '@nestjs/common';
import { DesignerService } from '../services/designer.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Controller('designer')
export class DesignerController {
  constructor(private designerService: DesignerService) {}

  @Post('project')
  async createProject(
    @Body() body: CreateProjectDto
  ) {
    return this.designerService.createProject(body.userId || null, body);
  }

  @Put('project/:id/dimensions')
  async updateDimensions(
    @Param('id') id: string,
    @Body()
    body: {
      width: number;
      length: number;
      height: number;
    }
  ) {
    return this.designerService.updateDimensions(id, body);
  }

  @Post('layout')
  async saveLayout(
    @Body() body: UpdateProjectDto
  ) {
    return this.designerService.saveLayout(body.userId || null, body);
  }

  @Get('customer/:userId')
  async getCustomerLayouts(@Param('userId') userId: string) {
    return this.designerService.getCustomerLayouts(userId);
  }

  @Get('layout/:id')
  async getLayout(@Param('id') id: string) {
    return this.designerService.getLayout(id);
  }

  @Post('log')
  async clientLog(@Body() body: { message: string; args?: any[] }) {
    console.log("[CLIENT LOG]", body.message, body.args || "");
    return { success: true };
  }
}
