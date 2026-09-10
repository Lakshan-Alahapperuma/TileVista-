import { execFile } from 'child_process';
import { promisify } from 'util';
const execute = promisify(execFile);

// Never interpolate upload paths into a shell command.
export async function runTool(binary: string, args: string[], timeout = 60 * 60 * 1000) {
  try {
    return await execute(binary, args, { timeout, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${binary} failed. Check the reconstruction server installation and video quality. ${detail.slice(-1500)}`);
  }
}
