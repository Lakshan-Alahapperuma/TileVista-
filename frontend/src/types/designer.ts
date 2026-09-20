export type RoomShape = 'rectangular' | 'square' | 'l-shape' | 't-shape' | 'u-shape' | 'custom';
export type UnitSystem = 'feet' | 'cm';

export interface TileItemDetails {
  itemId?: string | number;
  name?: string;
  imageUrl?: string;
  price?: number;
  dimensions?: { width: number; height: number; depth?: number; unit?: string } | null;
  size?: string | null;
  widthCm?: number;
  heightCm?: number;
}

export interface WallSplitDesign {
  splitMode: 'full' | 'horizontal' | 'vertical';
  tileColorBottom: string;
  tileColorTop: string;
  tileColorCenter: string;
  tileColorSides: string;
  textureUrl?: string;
  textureCoverageHeight?: number;
  tileAssetId?: string;
  tileItem?: TileItemDetails;
}

export interface PlacedItem {
  id: string;
  type: string;
  name: string;
  cost: number;
  position: [number, number, number];
  rotation: number;
  color?: string;
  model?: string;
  image?: string;
  isWallMounted: boolean;
  rotationOffset?: number;
  scale?: { x?: number; y?: number; z?: number };
}

export interface WallOpening {
  id: string;
  type: 'door' | 'window';
  style: string;
  name: string;
  wallIndex: number;
  positionOffset: number; // distance from start vertex in meters
  width: number;
  height: number;
  sillHeight: number; // height from floor in meters (0 for doors)
}

export interface DesignState {
  widthFt: number;
  depthFt: number;
  heightFt: number;
  shape: RoomShape;
  unit: UnitSystem;
  floorColor: string;
  floorTextureUrl?: string;
  floorTileItem?: TileItemDetails;
  wallTextureUrl?: string;
  wallTileItem?: TileItemDetails;
  wallDesigns: WallSplitDesign[];
  designType: 'room' | 'bathroom';
  subRoomType?: 'dining_room' | 'bed_room' | 'living_room';
  wallOpenings: WallOpening[];
  wastagePercent?: number;
}
