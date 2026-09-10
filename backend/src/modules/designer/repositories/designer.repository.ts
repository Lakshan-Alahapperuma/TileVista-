import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

import { UpdateProjectDto } from '../dto/update-project.dto';
import { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class DesignerRepository {
  constructor(private prisma: PrismaService) {}

  async getFirstUser() {
    return this.prisma.users.findFirst();
  }

  async getDefaultProduct() {
    return this.prisma.products.findFirst({
      include: { product_assets: true }
    });
  }

  async saveLayoutTransaction(designId: string, targetUserId: string, fallbackProductId: string, fallbackAssetId: string, data: UpdateProjectDto) {
    console.log("Saving layout with data:", data);
    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete existing elements to recreate them cleanly
      await tx.room_vertices.deleteMany({ where: { design_id: designId } });
      await tx.design_openings.deleteMany({ where: { design_id: designId } });
      await tx.design_items.deleteMany({ where: { design_id: designId } });
      await tx.custom_design_items.deleteMany({ where: { design_id: designId } });
      await tx.design_walls.deleteMany({ where: { design_id: designId } });

      // 2. Create or Update parent room_design
      let design = await tx.room_designs.findUnique({
        where: { design_id: designId }
      });

      if (design) {
        design = await tx.room_designs.update({
          where: { design_id: designId },
          data: {
            design_name: data.name,
            room_shape: data.shape,
            width: data.width,
            length: data.length,
            height: data.height,
            floor_texture_url: data.floorTextureUrl || null,
            wall_texture_url: data.wallTextureUrl || null,
            design_type: data.designType || design.design_type || 'bathroom',
            updated_at: new Date(),
          }
        });
      } else {
        design = await tx.room_designs.create({
          data: {
            design_id: designId,
            user_id: targetUserId,
            design_name: data.name,
            room_shape: data.shape,
            width: data.width,
            length: data.length,
            height: data.height,
            floor_texture_url: data.floorTextureUrl || null,
            wall_texture_url: data.wallTextureUrl || null,
            design_type: data.designType || 'bathroom',
          }
        });
      }

      // 3. Insert new room_vertices
      if (data.vertices && data.vertices.length > 0) {
        await tx.room_vertices.createMany({
          data: data.vertices.map((v) => ({
            vertex_id: crypto.randomUUID(),
            design_id: designId,
            x: v.x,
            y: v.y,
            z: v.z,
            sequence_order: v.sequence_order,
          }))
        });
      }

      // 4. Insert new design_walls and collect their wall_ids mapping to sequence order
      const wallIdMap = new Map<number, string>();
      if (data.walls && data.walls.length > 0) {
        for (const w of data.walls) {
          const wallId = crypto.randomUUID();
          wallIdMap.set(w.wall_sequence, wallId);

          let resolvedAssetId = null;
          if (w.tile_asset_id) {
            const osposId = parseInt(w.tile_asset_id);
            if (!isNaN(osposId)) {
              const product = await tx.products.findUnique({
                where: { ospos_item_id: osposId },
                include: { product_assets: true }
              });
              if (product && product.product_assets) {
                resolvedAssetId = product.product_assets.asset_id;
              }
            } else {
              resolvedAssetId = w.tile_asset_id;
            }
          }

          await tx.design_walls.create({
            data: {
              wall_id: wallId,
              design_id: designId,
              wall_label: w.wall_label,
              wall_sequence: w.wall_sequence,
              wall_length: w.wall_length,
              wall_height: w.wall_height,
              wall_color: w.wall_color,
              tile_asset_id: resolvedAssetId,
              tile_texture_url: w.tile_texture_url || null,
              tile_coverage_height: w.tile_coverage_height || null,
            }
          });
        }
      }

      // 5. Insert new design_openings (link to the newly created wall_id)
      if (data.openings && data.openings.length > 0) {
        for (const op of data.openings) {
          const wallId = wallIdMap.get(op.wall_sequence) || null;
          await tx.design_openings.create({
            data: {
              opening_id: crypto.randomUUID(),
              design_id: designId,
              type: op.type,
              style: op.style,
              width: op.width,
              height: op.height,
              wall_id: wallId,
              position_x: op.position_x,
              position_y: op.position_y,
            }
          });
        }
      }

      // 6. Insert new custom_design_items
      if (data.items && data.items.length > 0) {
        await tx.custom_design_items.createMany({
          data: data.items.map((it) => ({
            custom_item_id: crypto.randomUUID(),
            design_id: designId,
            item_type: it.type,
            item_name: it.name,
            model_url: it.modelUrl || `/images/furniture/${it.type}/${it.type}.glb`,
            position_x: it.position_x,
            position_y: it.position_y,
            position_z: it.position_z,
            rotation_y: it.rotation_y,
          }))
        });
      }

      return design;
    });
  }

  async createProject(designId: string, targetUserId: string, data: CreateProjectDto) {
    return this.prisma.room_designs.create({
      data: {
        design_id: designId,
        user_id: targetUserId,
        design_name: data.name,
        room_shape: data.shape,
        width: 0,
        length: 0,
        height: 0,
        design_type: data.designType || 'bathroom',
      },
    });
  }

  async updateDimensions(id: string, data: { width: number; length: number; height: number }) {
    return this.prisma.room_designs.update({
      where: { design_id: id },
      data: {
        width: data.width,
        length: data.length,
        height: data.height,
        updated_at: new Date(),
      },
    });
  }

  async getLayout(id: string) {
    return this.prisma.room_designs.findUnique({
      where: { design_id: id },
      include: {
        room_vertices: true,
        design_walls: {
          include: {
            design_openings: true,
          },
        },
        design_items: true,
        custom_design_items: true,
      },
    });
  }

  async getCustomerLayouts(userId: string) {
    return this.prisma.room_designs.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
    });
  }
}
