import { Module, DynamicModule } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ModelGeneratorController } from './model-generator.controller';
import { ModelGeneratorService } from './services/model-generator.service';
import { FrameExtractionService } from './services/frame-extraction.service';
import { ReconstructionService } from './services/reconstruction.service';
import { BlenderService } from './services/blender.service';
import { ModelGenerationProcessor } from './processors/model-generation.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({})
export class ModelGeneratorModule {
  static register(): DynamicModule {
    const redisAvailable = process.env.REDIS_AVAILABLE === 'true';

    if (redisAvailable) {
      return {
        module: ModelGeneratorModule,
        imports: [
          PrismaModule,
          BullModule.registerQueue({
            name: 'model-generation',
          }),
        ],
        controllers: [ModelGeneratorController],
        providers: [
          ModelGeneratorService,
          FrameExtractionService,
          ReconstructionService,
          BlenderService,
          ModelGenerationProcessor,
        ],
        exports: [ModelGeneratorService],
      };
    } else {
      return {
        module: ModelGeneratorModule,
        imports: [PrismaModule],
        controllers: [ModelGeneratorController],
        providers: [
          ModelGeneratorService,
          FrameExtractionService,
          ReconstructionService,
          BlenderService,
          {
            provide: getQueueToken('model-generation'),
            useFactory: (
              frame: FrameExtractionService,
              recon: ReconstructionService,
              blender: BlenderService,
              prisma: PrismaService,
            ) => {
              return {
                add: async (name: string, data: any) => {
                  (async () => {
                    const { projectId, itemId, inputVideoPath, framesFolder, reconstructionFolder, outputFolder } = data;
                    try {
                      // 1. Extract Frames
                      await prisma.modelGenerationProject.update({
                        where: { id: projectId },
                        data: {
                          status: 'EXTRACTING_FRAMES',
                          progress: 10,
                          currentStep: 'Extracting images from video',
                          processingStartedAt: new Date(),
                        },
                      });
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      await frame.extractFrames(inputVideoPath, framesFolder);

                      // 2. Reconstruct
                      await prisma.modelGenerationProject.update({
                        where: { id: projectId },
                        data: {
                          status: 'RECONSTRUCTING',
                          progress: 25,
                          currentStep: 'Reconstructing 3D mesh points',
                        },
                      });
                      await new Promise(resolve => setTimeout(resolve, 1500));
                      await recon.reconstruct(framesFolder, reconstructionFolder);

                      // 3. Export GLB
                      await prisma.modelGenerationProject.update({
                        where: { id: projectId },
                        data: {
                          status: 'EXPORTING_GLB',
                          progress: 80,
                          currentStep: 'Exporting 3D GLB model',
                        },
                      });
                      const outputGlbPath = await blender.exportGlb(reconstructionFolder, outputFolder, projectId);

                      // 4. Complete
                      await prisma.modelGenerationProject.update({
                        where: { id: projectId },
                        data: {
                          status: 'COMPLETED',
                          progress: 100,
                          currentStep: '3D model generation completed',
                          outputGlbPath,
                          completedAt: new Date(),
                        },
                      });

                      // Auto-link GLB asset to product item if itemId was supplied
                      if (itemId) {
                        const numericItemId = parseInt(itemId, 10);
                        if (!isNaN(numericItemId)) {
                          try {
                            const modelsDir = join(process.cwd(), 'uploads', 'models');
                            await fs.mkdir(modelsDir, { recursive: true });
                            const newFilename = `item-${numericItemId}.glb`;
                            const destPath = join(modelsDir, newFilename);
                            await fs.copyFile(outputGlbPath, destPath);

                            const glbUrl = `/uploads/models/${newFilename}`;
                            const product = await prisma.products.findUnique({
                              where: { ospos_item_id: numericItemId },
                              include: { product_assets: true },
                            });

                            if (product) {
                              if (product.product_assets) {
                                await prisma.product_assets.update({
                                  where: { asset_id: product.product_assets.asset_id },
                                  data: { glb_url: glbUrl },
                                });
                              } else {
                                await prisma.product_assets.create({
                                  data: {
                                    asset_id: randomUUID(),
                                    product_id: product.product_id,
                                    glb_url: glbUrl,
                                  },
                                });
                              }
                            }
                          } catch (linkErr) {
                            console.error('Failed to auto-link GLB asset to item:', linkErr);
                          }
                        }
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Processing error';
                      await prisma.modelGenerationProject.update({
                        where: { id: projectId },
                        data: {
                          status: 'FAILED',
                          currentStep: 'Generation failed',
                          errorMessage,
                        },
                      });
                    }
                  })();

                  return { id: `mock-job-${Date.now()}` };
                },
              };
            },
            inject: [
              FrameExtractionService,
              ReconstructionService,
              BlenderService,
              PrismaService,
            ],
          },
        ],
        exports: [ModelGeneratorService],
      };
    }
  }
}
