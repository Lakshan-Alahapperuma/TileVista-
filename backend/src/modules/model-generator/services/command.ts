import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execute = promisify(execFile);

export function resolveBinaryPath(binary: string): string {
  if (binary.startsWith('/') && existsSync(binary)) {
    return binary;
  }

  const candidates: string[] = [];

  if (binary.includes('ffmpeg')) {
    candidates.push(
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
    );
  } else if (binary.includes('colmap')) {
    candidates.push(
      '/opt/homebrew/bin/colmap',
      '/usr/local/bin/colmap',
      '/usr/bin/colmap',
    );
  } else if (binary.includes('blender')) {
    candidates.push(
      '/Applications/Blender.app/Contents/MacOS/Blender',
      '/opt/homebrew/bin/blender',
      '/usr/local/bin/blender',
      '/usr/bin/blender',
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return binary;
}

// Never interpolate upload paths into a shell command.
export async function runTool(binary: string, args: string[], timeout = 60 * 60 * 1000) {
  const resolvedBinary = resolveBinaryPath(binary);
  try {
    return await execute(resolvedBinary, args, { timeout, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${binary} failed. Check the reconstruction server installation and video quality. ${detail.slice(-1500)}`);
  }
}

