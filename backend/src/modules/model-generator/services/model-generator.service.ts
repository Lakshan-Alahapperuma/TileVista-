import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateModelProjectDto } from '../dto/create-model-project.dto';

@Injectable()
export class ModelGeneratorService {
  constructor(
    private readonly prisma: PrismaService,

    @InjectQueue('model-generation')
    private readonly modelGenerationQueue: Queue,
  ) {}

  async createFromVideo(
    dto: CreateModelProjectDto,
    video: Express.Multer.File,
    userId: string,
  ) {
    if (!video) {
      throw new BadRequestException('Please upload an object video');
    }

    if (dto.itemId) {
      const itemId = Number(dto.itemId);
      if (!Number.isSafeInteger(itemId) || itemId < 1) {
        throw new BadRequestException('Invalid item ID.');
      }
      const product = await this.prisma.products.findUnique({ where: { ospos_item_id: itemId } });
      if (!product) {
        throw new BadRequestException('Invalid item ID: existing catalog item not found.');
      }
    }

    const originalFilename = video.originalname || '';
    const description = dto.description
      ? `${dto.description} (Original: ${originalFilename})`
      : `(Original: ${originalFilename})`;

    const project = await this.prisma.modelGenerationProject.create({
      data: {
        userId,
        name: dto.name,
        description,
        inputType: 'VIDEO',
        status: 'UPLOADED',
        fileSize: BigInt(video.size),
      },
    });

    const projectFolder = join(
      process.cwd(),
      'uploads',
      'model-projects',
      project.id,
    );

    const inputFolder = join(projectFolder, 'input');
    const framesFolder = join(projectFolder, 'frames');
    const reconstructionFolder = join(projectFolder, 'reconstruction');
    const outputFolder = join(projectFolder, 'output');

    try {
    await Promise.all([
      fs.mkdir(inputFolder, { recursive: true }),
      fs.mkdir(framesFolder, { recursive: true }),
      fs.mkdir(reconstructionFolder, { recursive: true }),
      fs.mkdir(outputFolder, { recursive: true }),
    ]);

    const inputExtension = ({ 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' })[video.mimetype] || '.mp4';
    const inputVideoPath = join(
      inputFolder,
      `object-video${inputExtension}`,
    );

    await fs.writeFile(inputVideoPath, video.buffer);

    await this.prisma.modelGenerationProject.update({
      where: {
        id: project.id,
      },
      data: {
        inputVideoPath,
        status: 'QUEUED',
        currentStep: 'Waiting for processing',
      },
    });

    await this.modelGenerationQueue.add(
      'generate-glb',
      {
        projectId: project.id,
        itemId: dto.itemId,
        inputVideoPath,
        projectFolder,
        framesFolder,
        reconstructionFolder,
        outputFolder,
      },
      {
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );

    } catch (error) {
      await this.prisma.modelGenerationProject.update({
        where: { id: project.id },
        data: { status: 'FAILED', currentStep: 'Upload or queue submission failed',
          errorMessage: error instanceof Error ? error.message : 'Queue unavailable' },
      });
      throw error;
    }

    return {
      id: project.id,
      name: project.name,
      status: 'QUEUED',
      progress: 0,
      message: 'The video was uploaded successfully.',
    };
  }

  async findUserProjects(userId: string) {
    const projects = await this.prisma.modelGenerationProject.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return projects.map((project) => ({
      ...project,
      fileSize: project.fileSize?.toString(),
      modelUrl: project.outputGlbPath
        ? `/uploads/model-projects/${project.id}/output/model.glb`
        : null,
    }));
  }

  async findProject(projectId: string) {
    const project = await this.prisma.modelGenerationProject.findUnique({
      where: {
        id: projectId,
      },
      include: {
        images: true,
      },
    });

    if (!project) {
      throw new NotFoundException('3D model project was not found');
    }

    return {
      ...project,
      fileSize: project.fileSize?.toString(),
      modelUrl: project.outputGlbPath
        ? `/uploads/model-projects/${project.id}/output/model.glb`
        : null,
    };
  }

  async getProjectStatus(projectId: string) {
    const project = await this.prisma.modelGenerationProject.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        status: true,
        progress: true,
        currentStep: true,
        outputGlbPath: true,
        errorMessage: true,
      },
    });

    if (!project) {
      throw new NotFoundException('3D model project was not found');
    }

    return {
      ...project,
      modelUrl: project.outputGlbPath
        ? `/uploads/model-projects/${project.id}/output/model.glb`
        : null,
    };
  }

  async removeProject(projectId: string) {
    const project = await this.findProject(projectId);

    if (!['COMPLETED', 'FAILED'].includes(project.status)) {
      throw new BadRequestException('Wait until processing finishes before deleting this project.');
    }

    await this.prisma.modelGenerationProject.delete({
      where: {
        id: projectId,
      },
    });

    const projectFolder = join(
      process.cwd(),
      'uploads',
      'model-projects',
      projectId,
    );

    await fs.rm(projectFolder, {
      recursive: true,
      force: true,
    });

    return {
      message: '3D model project deleted successfully',
    };
  }
}
