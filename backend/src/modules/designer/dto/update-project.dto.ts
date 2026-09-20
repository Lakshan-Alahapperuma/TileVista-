export class UpdateProjectDto {
  id?: string;
  userId?: string;
  name: string;
  shape: string;
  width: number;
  length: number;
  height: number;
  floorTextureUrl?: string;
  wallTextureUrl?: string;
  designType?: 'room' | 'bathroom';
  vertices?: Array<{ x: number; y: number; z: number; sequence_order: number }>;
  walls?: Array<{
    wall_label: string;
    wall_sequence: number;
    wall_length: number;
    wall_height: number;
    wall_color: string;
    tile_asset_id?: string | null;
    tile_texture_url?: string | null;
    tile_coverage_height?: number | null;
  }>;
  openings?: Array<{
    type: 'door' | 'window';
    style: string;
    width: number;
    height: number;
    wall_sequence: number;
    position_x: number;
    position_y: number;
  }>;
  items?: Array<{
    type: string;
    name: string;
    cost: number;
    position_x: number;
    position_y: number;
    position_z: number;
    rotation_y: number;
    modelUrl?: string;
  }>;
  measurements?: Array<{
    point_a_x: number;
    point_a_y: number;
    point_a_z: number;
    point_b_x: number;
    point_b_y: number;
    point_b_z: number;
    distance: number;
  }>;
}
