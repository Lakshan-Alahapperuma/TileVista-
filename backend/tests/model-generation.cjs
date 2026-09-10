const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FrameExtractionService } = require('../dist/modules/model-generator/services/frame-extraction.service');
const { ReconstructionService } = require('../dist/modules/model-generator/services/reconstruction.service');
const { BlenderService } = require('../dist/modules/model-generator/services/blender.service');
const { ModelGeneratorService } = require('../dist/modules/model-generator/services/model-generator.service');
const { ModelGenerationProcessor } = require('../dist/modules/model-generator/processors/model-generation.processor');

test('missing tools fail without producing substitute geometry or frames', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tilevista-test-'));
  const old = [process.env.FFMPEG_BIN, process.env.COLMAP_BIN, process.env.BLENDER_BIN];
  try {
    process.env.FFMPEG_BIN = process.env.COLMAP_BIN = process.env.BLENDER_BIN = '/missing/tilevista-tool';
    await assert.rejects(new FrameExtractionService().extractFrames('video.mp4', dir), /failed/);
    await assert.rejects(new ReconstructionService().reconstruct(dir, dir), /failed/);
    await assert.rejects(new BlenderService().exportGlb(dir, dir), /failed/);
    assert.deepEqual(await fs.readdir(dir), []);
  } finally {
    ['FFMPEG_BIN','COLMAP_BIN','BLENDER_BIN'].forEach((key, i) => old[i] === undefined ? delete process.env[key] : process.env[key] = old[i]);
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('unknown catalog item is rejected before creating a project', async () => {
  const service = new ModelGeneratorService({ products: { findUnique: async () => null } }, {});
  await assert.rejects(service.createFromVideo({ itemId: '9' }, {}, 'admin'), /existing catalog item/);
});

test('processing failure records FAILED and never links a model', async () => {
  const updates = [];
  const prisma = { modelGenerationProject: { update: async value => updates.push(value.data) } };
  const processor = new ModelGenerationProcessor(prisma, { extractFrames: async () => { throw new Error('invalid video'); } }, {}, {});
  await assert.rejects(processor.process({ data: { projectId: 'x' }, updateProgress: async () => {} }), /invalid video/);
  assert.equal(updates.at(-1).status, 'FAILED');
  assert.ok(!updates.some(value => value.status === 'COMPLETED'));
});

test('catalog linking failure cannot mark reconstruction completed', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tilevista-output-'));
  const updates = [];
  const prisma = { modelGenerationProject: { update: async value => updates.push(value.data) },
    $transaction: async () => { throw new Error('database unavailable'); } };
  try {
    const processor = new ModelGenerationProcessor(prisma, { extractFrames: async () => [] },
      { reconstruct: async () => '' }, { exportGlb: async () => path.join(dir, 'model.glb') });
    await assert.rejects(processor.process({ data: { projectId: 'x' }, updateProgress: async () => {} }), /database unavailable/);
    assert.equal(updates.at(-1).status, 'FAILED');
    assert.ok(!updates.some(value => value.status === 'COMPLETED'));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
