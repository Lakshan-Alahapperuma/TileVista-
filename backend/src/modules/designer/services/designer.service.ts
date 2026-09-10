import { Injectable, NotFoundException } from '@nestjs/common';
import { DesignerRepository } from '../repositories/designer.repository';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class DesignerService {
  constructor(private designerRepository: DesignerRepository) {}

  async saveLayout(userId: string | null, data: UpdateProjectDto) {
    // Resolve user_id: if null, fallback to the first active user in the database
    let targetUserId = userId;
    if (!targetUserId) {
      const firstUser = await this.designerRepository.getFirstUser();
      targetUserId = firstUser ? firstUser.user_id : '';
    }

    const designId = data.id || crypto.randomUUID();

    // Find default product & asset for design_items fallback mapping
    const defaultProduct = await this.designerRepository.getDefaultProduct();
    const fallbackProductId = defaultProduct ? defaultProduct.product_id : '';
    const fallbackAssetId = (defaultProduct && defaultProduct.product_assets) ? defaultProduct.product_assets.asset_id : '';

    const design = await this.designerRepository.saveLayoutTransaction(
      designId,
      targetUserId,
      fallbackProductId,
      fallbackAssetId,
      data
    );

    return {
      id: design.design_id,
      userId: design.user_id,
      name: design.design_name,
      shape: design.room_shape,
      width: Number(design.width),
      length: Number(design.length),
      height: Number(design.height),
    };
  }

  async createProject(userId: string | null, data: CreateProjectDto) {
    let targetUserId = userId;
    if (!targetUserId) {
      const firstUser = await this.designerRepository.getFirstUser();
      targetUserId = firstUser ? firstUser.user_id : '';
    }

    const designId = crypto.randomUUID();
    const design = await this.designerRepository.createProject(designId, targetUserId, data);

    return {
      id: design.design_id,
      userId: design.user_id,
      name: design.design_name,
      shape: design.room_shape,
      width: 0,
      length: 0,
      height: 0,
    };
  }

  async updateDimensions(id: string, data: { width: number; length: number; height: number }) {
    const design = await this.designerRepository.updateDimensions(id, data);

    return {
      id: design.design_id,
      userId: design.user_id,
      name: design.design_name,
      shape: design.room_shape,
      width: Number(design.width),
      length: Number(design.length),
      height: Number(design.height),
    };
  }

  async getLayout(id: string) {
    const layout = await this.designerRepository.getLayout(id);

    if (!layout) {
      throw new NotFoundException(`Bathroom layout with ID ${id} not found`);
    }

    return {
      id: layout.design_id,
      userId: layout.user_id,
      name: layout.design_name,
      shape: layout.room_shape,
      width: Number(layout.width),
      length: Number(layout.length),
      height: Number(layout.height),
      floorTextureUrl: layout.floor_texture_url || undefined,
      wallTextureUrl: layout.wall_texture_url || undefined,
      type: layout.design_type,
      vertices: layout.room_vertices.map((v) => ({
        x: Number(v.x),
        y: Number(v.y),
        z: Number(v.z),
        sequence_order: v.sequence_order,
      })),
      walls: layout.design_walls.map((w) => ({
        id: w.wall_id,
        label: w.wall_label,
        sequence: w.wall_sequence,
        length: Number(w.wall_length),
        height: Number(w.wall_height),
        color: w.wall_color,
        tileAssetId: w.tile_asset_id,
        textureUrl: w.tile_texture_url,
        tileCoverageHeight: w.tile_coverage_height ? Number(w.tile_coverage_height) : null,
        openings: w.design_openings.map((op) => ({
          id: op.opening_id,
          type: op.type,
          style: op.style,
          width: Number(op.width),
          height: Number(op.height),
          position_x: Number(op.position_x),
          position_y: Number(op.position_y),
        })),
      })),
      items: ((layout as any).custom_design_items || []).map((it: any) => ({
        id: it.custom_item_id,
        type: it.item_type,
        name: it.item_name,
        modelUrl: it.model_url,
        position: [Number(it.position_x), Number(it.position_y), Number(it.position_z)],
        rotation: [0, Number(it.rotation_y), 0],
      })),
      measurements: [],
    };
  }

  async getCustomerLayouts(userId: string) {
    let targetUserId = userId;
    if (userId === 'default' || !userId) {
      const firstUser = await this.designerRepository.getFirstUser();
      targetUserId = firstUser ? firstUser.user_id : '';
    }
    const designs = await this.designerRepository.getCustomerLayouts(targetUserId);
    return designs.map((layout) => ({
      id: layout.design_id,
      userId: layout.user_id,
      name: layout.design_name,
      shape: layout.room_shape,
      type: layout.design_type,
      width: Number(layout.width),
      length: Number(layout.length),
      height: Number(layout.height),
      wallDesigns: [],
      placements: [],
    }));
  }
}
