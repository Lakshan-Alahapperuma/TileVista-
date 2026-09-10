import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { runTool } from './command';

@Injectable()
export class FrameExtractionService {
  async extractFrames(videoPath: string, outputDir: string): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });
    // Bound processing to three minutes / 720 frames; retries overwrite old frames.
    await runTool(process.env.FFMPEG_BIN || 'ffmpeg', [
      '-nostdin', '-y', '-v', 'error', '-i', videoPath, '-t', '180',
      '-vf', 'fps=4,scale=1920:1920:force_original_aspect_ratio=decrease',
      '-q:v', '2', join(outputDir, 'frame_%04d.jpg'),
    ], 10 * 60 * 1000);
    let files = (await fs.readdir(outputDir)).filter(f => /^frame_\d+\.jpg$/.test(f)).sort();
    
    // If short video produced less than 15 frames at 4fps, re-extract at 12fps to capture sufficient detail
    if (files.length > 0 && files.length < 15) {
      await runTool(process.env.FFMPEG_BIN || 'ffmpeg', [
        '-nostdin', '-y', '-v', 'error', '-i', videoPath, '-t', '180',
        '-vf', 'fps=12,scale=1920:1920:force_original_aspect_ratio=decrease',
        '-q:v', '2', join(outputDir, 'frame_%04d.jpg'),
      ], 10 * 60 * 1000);
      files = (await fs.readdir(outputDir)).filter(f => /^frame_\d+\.jpg$/.test(f)).sort();
    }

    if (files.length === 0) {
      throw new Error('Could not extract any image frames from the uploaded video. Please ensure it is a valid MP4/MOV video.');
    }
    return files.map(f => join(outputDir, f));
  }
}
