import { IsNumber, IsString, IsOptional, IsIn, IsPositive, IsBoolean } from 'class-validator';

/**
 * The unified DTO representing a merged OSPOS item + TileVista asset entry.
 * Live pricing, stock, SKU, name, and category come from OSPOS.
 * Visual and 3D asset data come from the TileVista product_assets and related tables.
 */
export class UnifiedItemDto {
  /** OSPOS item_id — the single source of truth identifier */
  itemId: number;
  /** Live item name from OSPOS */
  name: string;
  /** Category string from OSPOS (e.g. "Tiles", "Sanitaryware") */
  category: string;
  /** Category ID from OSPOS */
  categoryId: number | null;
  /** Subcategory ID from OSPOS */
  subcategoryId: number | null;
  /** Item number / SKU from OSPOS */
  sku: string;
  /** Description from OSPOS */
  description: string | null;
  /** Live unit price from OSPOS */
  price: number;
  /** Live quantity at location 1 from OSPOS */
  quantity: number;
  /** Brand from OSPOS attribute link */
  brand: string | null;
  /** Color from OSPOS attribute link */
  color: string | null;
  /** Size description (e.g. "60x60 cm") from OSPOS attribute or asset_sizes */
  size: string | null;
  /** 3D physical dimensions for virtual room designer (width, height, depth, unit) */
  dimensions: { width: number; height: number; depth: number; unit: string } | null;


  // ── Asset Catalog Fields (from TileVista product_assets) ─────────────
  /** Full URL to the product image, or null if no image uploaded */
  imageUrl: string | null;
  /** Full URL to the GLB 3D model file, or null if not uploaded */
  glbUrl: string | null;
  /** 3D scale factors for the GLB model */
  scale: { x: number; y: number; z: number };
  /** Y-axis rotation for the GLB model in degrees */
  rotationY: number;
  /** Array of descriptive tags (e.g. ["floor", "matte", "600x600"]) */
  tags: string[];
  /** Material description (e.g. "Porcelain") */
  material: string | null;
  /** Surface finish (e.g. "Matte", "Glossy") */
  finish: string | null;
  /** Whether this item is enabled / visible on the public site */
  isEnabled: boolean;
  /** Admin notes for asset management */
  notes: string | null;
  /** True if a TileVista asset catalog entry exists for this OSPOS item */
  hasAssetEntry: boolean;
  /** Flag indicating if the stock data is stale (fetched from fallback state) */
  isStaleData?: boolean;
}

export class UpsertAssetDto {
  @IsOptional() @IsNumber()
  scaleX?: number;
  @IsOptional() @IsNumber()
  scaleY?: number;
  @IsOptional() @IsNumber()
  scaleZ?: number;
  @IsOptional() @IsNumber()
  rotationY?: number;
  @IsOptional() @IsString()
  tags?: string; // comma-separated
  @IsOptional() @IsString()
  material?: string;
  @IsOptional() @IsString()
  finish?: string;
  @IsOptional() @IsBoolean()
  isEnabled?: boolean;
  @IsOptional() @IsString()
  notes?: string;
  @IsOptional() @IsNumber()
  width?: number;
  @IsOptional() @IsNumber()
  height?: number;
  @IsOptional() @IsNumber()
  depth?: number;
  @IsOptional() @IsString()
  @IsIn(['cm', 'm'])
  unit?: 'cm' | 'm';
}

export class PublishProductDto {
  @IsNumber()
  osposItemId: number;

  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  glbUrl?: string;

  @IsOptional()
  @IsString()
  materialType?: string;

  @IsOptional()
  @IsString()
  colorFamily?: string;

  @IsNumber()
  @IsPositive()
  width: number;

  @IsNumber()
  @IsPositive()
  height: number;

  @IsNumber()
  @IsPositive()
  depth: number;

  @IsString()
  @IsIn(['cm', 'm'])
  unit: 'cm' | 'm';
}
