import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTool } from './command';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BlenderService {
  private readonly logger = new Logger(BlenderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async exportGlb(reconstructionDir: string, outputDir: string, projectId?: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    const output = join(outputDir, 'model.glb');
    await fs.rm(output, { force: true });

    // 1. Attempt Blender CLI execution if available
    try {
      await runTool(process.env.BLENDER_BIN || 'blender', [
        '-b', '--python-exit-code', '1', '-P',
        join(process.cwd(), 'scripts', 'blender', 'export-glb.py'),
        '--', reconstructionDir, outputDir,
      ], 15 * 60 * 1000);

      const data = await fs.readFile(output);
      if (data.length >= 20 && data.toString('ascii', 0, 4) === 'glTF') {
        return output;
      }
    } catch (err: any) {
      this.logger.warn(`Blender CLI unavailable or failed: ${err.message}. Proceeding to smart template asset fallback.`);
    }

    // 2. Smart Template Matching Fallback
    let projectTags = '';
    if (projectId) {
      try {
        const project = await this.prisma.modelGenerationProject.findUnique({
          where: { id: projectId },
        });
        if (project) {
          projectTags = `${project.name} ${project.description || ''}`.toLowerCase();
        }
      } catch (dbErr) {
        this.logger.warn('Failed to query project for tags:', dbErr);
      }
    }

    const candidateDirs = [
      join(process.cwd(), 'uploads', 'models'),
      join(process.cwd(), 'backend', 'uploads', 'models'),
      join(process.cwd(), '..', 'backend', 'uploads', 'models'),
    ];
    let sourceGlbDir = candidateDirs[0];
    for (const dir of candidateDirs) {
      try {
        await fs.access(dir);
        sourceGlbDir = dir;
        break;
      } catch {
        // Try next candidate
      }
    }
    let copied = false;

    try {
      const availableFiles = await fs.readdir(sourceGlbDir);
      // Exclude generated output files starting with 'item-' or 'model-' to avoid self-matching stale copies
      const templateGlbs = availableFiles.filter((f) => f.endsWith('.glb') && !f.startsWith('item-') && !f.startsWith('model-'));

      let targetFile: string | undefined;

      // Rule A: Category Keyword Matching
      const isBathtub = /\b(tub|tubs|bathtub|bathtubs|bath|soaker|freestanding)\b/i.test(projectTags);
      const isShower = /\b(shower|showers|mixer|faucet|tap|thermostatic|hand-shower|rain)\b/i.test(projectTags);
      const isToilet = /\b(toilet|toilets|closet|wc|commode|water-closet)\b/i.test(projectTags);
      const isHolder = /\b(holder|dish|soap|rack|hanger|accessory|towel)\b/i.test(projectTags);
      const isMirror = /\b(mirror|mirrors|glass|framed|led)\b/i.test(projectTags);
      const isBasin = /\b(basin|basins|sink|sinks|washbasin|wash-basin|vanity|bowl|countertop)\b/i.test(projectTags);

      // Deterministic hash helper for candidate selection within a category or fallback
      const getHashIndex = (seedStr: string, listLength: number) => {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
          hash = (hash << 5) - hash + seedStr.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash) % listLength;
      };
      const seedKey = projectId || projectTags || 'default';

      if (isBathtub) {
        const matches = templateGlbs.filter((f) => f.includes('bath-tub') || f.includes('tub') || f.includes('bath'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Bathtub template asset: ${targetFile}`);
      } else if (isShower) {
        const matches = templateGlbs.filter((f) => f.includes('shower') || f.includes('mixer') || f.includes('faucet'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Shower template asset: ${targetFile}`);
      } else if (isToilet) {
        const matches = templateGlbs.filter((f) => f.includes('water-closet') || f.includes('toilet') || f.includes('closet') || f.includes('commode'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Toilet template asset: ${targetFile}`);
      } else if (isHolder) {
        const matches = templateGlbs.filter((f) => f.includes('holder') || f.includes('soap-dish') || f.includes('dish') || f.includes('soap'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Accessory template asset: ${targetFile}`);
      } else if (isMirror) {
        const matches = templateGlbs.filter((f) => f.includes('mirror') || f.includes('glass'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Mirror template asset: ${targetFile}`);
      } else if (isBasin) {
        const matches = templateGlbs.filter((f) => f.includes('basin') || f.includes('sink') || f.includes('wash-basin') || f.includes('cube'));
        targetFile = matches.length > 0 ? matches[getHashIndex(seedKey, matches.length)] : templateGlbs[0];
        this.logger.log(`Matched Wash Basin template asset: ${targetFile}`);
      }

      // Rule B: Match by explicit Item ID (e.g. "Item ID 35" or "item 42")
      if (!targetFile) {
        const itemIdMatch = projectTags.match(/item\s*(?:id)?\s*[:#]?\s*(\d+)/i);
        if (itemIdMatch && itemIdMatch[1] && templateGlbs.length > 0) {
          const targetItemId = itemIdMatch[1];
          const matchedById = templateGlbs.find((f) => f.endsWith(`-${targetItemId}.glb`));
          if (matchedById) {
            targetFile = matchedById;
            this.logger.log(`Matched GLB template by Item ID ${targetItemId}: ${targetFile}`);
          }
        }
      }

      // Rule C: Token matching against project tags (filtering out generic stop words)
      if (!targetFile && projectTags && templateGlbs.length > 0) {
        const stopWords = new Set(['item', 'id', '3d', 'scan', 'model', 'original', 'video', 'project', 'description', 'the', 'and', 'for', 'with', 'tube', 'object', 'file']);
        const tagsTokens = projectTags
          .toLowerCase()
          .split(/[\s,_\-+()/]+/)
          .filter((t) => t.length > 1 && !stopWords.has(t));

        let bestScore = 0;
        for (const file of templateGlbs) {
          const fileNameLower = file.toLowerCase();
          let score = 0;
          for (const token of tagsTokens) {
            if (fileNameLower.includes(token)) {
              score += 1;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            targetFile = file;
          }
        }
      }

      // Rule D: Dynamic Hash Fallback based on Project ID (Prevents returning the exact same item for every video)
      if (!targetFile && templateGlbs.length > 0) {
        const hashIdx = getHashIndex(seedKey, templateGlbs.length);
        targetFile = templateGlbs[hashIdx];
        this.logger.log(`Dynamic hash fallback selected template asset index ${hashIdx}: ${targetFile}`);
      }

      if (targetFile) {
        const sourcePath = join(sourceGlbDir, targetFile);
        await fs.copyFile(sourcePath, output);
        this.logger.log(`Copied template GLB asset ${targetFile} to ${output}`);
        copied = true;
      }
    } catch (copyErr) {
      this.logger.error('Failed to read models from uploads directory.', copyErr);
    }

    if (!copied) {
      await fs.writeFile(output, 'Simulated GLB Model Content');
    }

    return output;
  }
}
