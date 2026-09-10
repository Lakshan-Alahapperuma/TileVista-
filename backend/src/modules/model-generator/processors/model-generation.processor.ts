import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { FrameExtractionService } from '../services/frame-extraction.service';
import { ReconstructionService } from '../services/reconstruction.service';
import { BlenderService } from '../services/blender.service';
import { ModelGenerationJob } from '../model-generator.types';

@Processor('model-generation', { concurrency: 1 })
export class ModelGenerationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly frameExtractionService: FrameExtractionService,
    private readonly reconstructionService: ReconstructionService,
    private readonly blenderService: BlenderService,
  ) {
    super();
  }

  async process(job: Job<ModelGenerationJob>) {
    const {
      projectId,
      itemId,
      inputVideoPath,
      framesFolder,
      reconstructionFolder,
      outputFolder,
    } = job.data;

    try {
      await this.updateProject(
        projectId,
        'EXTRACTING_FRAMES',
        10,
        'Extracting images from video',
      );

      await this.frameExtractionService.extractFrames(
        inputVideoPath,
        framesFolder,
      );

      await job.updateProgress(20);

      await this.updateProject(
        projectId,
        'RECONSTRUCTING',
        25,
        'Finding matching points between images',
      );

      await this.reconstructionService.reconstruct(
        framesFolder,
        reconstructionFolder,
      );

      await job.updateProgress(75);

      await this.updateProject(
        projectId,
        'EXPORTING_GLB',
        80,
        'Cleaning and exporting the 3D model',
      );

      const outputGlbPath = await this.blenderService.exportGlb(
        reconstructionFolder,
        outputFolder,
        projectId,
      );

      // Publish the asset and completion together so polling never reports a false success.
      let glbUrl: string | undefined;
      if (itemId) {
        const modelsDir = join(process.cwd(), 'uploads', 'models');
        await fs.mkdir(modelsDir, { recursive: true });
        const filename = `item-${Number(itemId)}.glb`;
        await fs.copyFile(outputGlbPath, join(modelsDir, filename));
        glbUrl = `/uploads/models/${filename}`;
      }
      await this.prisma.$transaction(async (tx) => {
        if (itemId && glbUrl) {
          const product = await tx.products.findUnique({ where: { ospos_item_id: Number(itemId) } });
          if (!product) throw new Error('Catalog item no longer exists.');
          await tx.product_assets.upsert({
            where: { product_id: product.product_id },
            create: { asset_id: randomUUID(), product_id: product.product_id, glb_url: glbUrl },
            update: { glb_url: glbUrl },
          });
        }
        await tx.modelGenerationProject.update({
          where: { id: projectId },
          data: { status: 'COMPLETED', progress: 100, currentStep: '3D model generation completed',
            outputGlbPath, errorMessage: null, completedAt: new Date() },
        });
      });

      return {
        projectId,
        outputGlbPath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown reconstruction error';

      await this.prisma.modelGenerationProject.update({
        where: {
          id: projectId,
        },
        data: {
          status: 'FAILED',
          currentStep: 'Generation failed',
          errorMessage,
        },
      });

      throw error;
    }
  }

  private async updateProject(
    projectId: string,
    status:
      | 'EXTRACTING_FRAMES'
      | 'RECONSTRUCTING'
      | 'EXPORTING_GLB',
    progress: number,
    currentStep: string,
  ) {
    await this.prisma.modelGenerationProject.update({
      where: {
        id: projectId,
      },
      data: {
        status,
        progress,
        currentStep,
        processingStartedAt: new Date(),
        errorMessage: null,
      },
    });
  }
}
