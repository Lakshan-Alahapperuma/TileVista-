# Admin video reconstruction

Integration: Admin → item asset catalog → select an accessory → Generate 3D Object.
The existing modal uploads to `POST /api/model-generator/projects/video`, polls the project status and refreshes the item after completion. These endpoints require an ADMIN JWT.

The backend runs FFmpeg → COLMAP dense Poisson reconstruction → Blender GLB export. Captured vertex colors are retained where available. No stock assets, procedural models, or fake files are used on failure. A completed job links a unique GLB URL to the selected product in the same database transaction as completion. Existing assets remain linked if processing fails.

## Server setup

Use a dedicated reconstruction-capable host with FFmpeg, COLMAP with a supported GPU dense reconstruction backend (CUDA is the established option), Blender 4+, Redis, and the existing MySQL database. Run from the backend directory using the workspace scripts. All workers must share the same uploads filesystem; use one worker deployment initially.

Set these variables in the root `.env` before starting the backend:

```
REDIS_AVAILABLE=true
REDIS_HOST=localhost
REDIS_PORT=6379
FFMPEG_BIN=ffmpeg
COLMAP_BIN=colmap
BLENDER_BIN=blender
```

Binary variables may be absolute paths. Redis configuration is explicit at application startup; there is no in-memory fallback. With reconstruction disabled, the rest of the application works and uploads return a service-unavailable error.

Generate the existing Prisma client and apply the project's schema changes through your normal database migration workflow before starting. The ModelGenerationProject tables must exist. Run `npm run build:backend` and `node --test backend/tests/model-generation.cjs` from the repository root.

## Capture and limitations

Record 10–180 seconds, moving around a stationary accessory at multiple heights with overlapping, sharp views and diffuse light. Only the first 180 seconds are processed, at four frames per second. Avoid people and moving backgrounds. Reflective chrome, mirrors, transparent glass and plain glossy ceramics often cannot be reconstructed reliably with ordinary photogrammetry.

This reconstructs the captured scene, not an automatically segmented accessory: background removal, orientation, mesh cleanup and measured scale may require manual review. Video alone does not establish physical dimensions. Do not claim exact geometry, calibrated scale or production quality; inspect the result in the catalog viewer before customer use. Full texture baking and automatic object segmentation are not implemented.

COLMAP's documented pipeline: https://colmap.github.io/cli.html

## Verification on the development machine

Backend build and frontend type checks can run without a reconstruction server. A real reconstruction requires a suitable video and working external binaries. On the inspected Mac, COLMAP fails to load a protobuf dependency and Blender is absent. No real video reconstruction has been verified on that machine.
