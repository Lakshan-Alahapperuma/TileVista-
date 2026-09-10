import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelGeneratorService } from './services/model-generator.service';
import { CreateModelProjectDto } from './dto/create-model-project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('model-generator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ModelGeneratorController {
  constructor(
    private readonly modelGeneratorService: ModelGeneratorService,
  ) {}

  @Post('projects/video')
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
      },
      fileFilter: (_request, file, callback) => {
        const supportedTypes = [
          'video/mp4',
          'video/quicktime',
          'video/webm',
        ];

        if (!supportedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only MP4, MOV and WebM videos are supported'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  createFromVideo(
    @UploadedFile() video: Express.Multer.File,
    @Body() dto: CreateModelProjectDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.modelGeneratorService.createFromVideo(dto, video, userId);
  }

  @Get('projects')
  findUserProjects(@Req() req: any) {
    const userId = req.user.id;
    return this.modelGeneratorService.findUserProjects(userId);
  }

  @Get('projects/:projectId')
  findProject(@Param('projectId') projectId: string) {
    return this.modelGeneratorService.findProject(projectId);
  }

  @Get('projects/:projectId/status')
  getProjectStatus(@Param('projectId') projectId: string) {
    return this.modelGeneratorService.getProjectStatus(projectId);
  }

  @Delete('projects/:projectId')
  removeProject(@Param('projectId') projectId: string) {
    return this.modelGeneratorService.removeProject(projectId);
  }
}
