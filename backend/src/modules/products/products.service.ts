import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OsposIntegrationService, OsposItem } from '../integrations/ospos/ospos.service';
import { UnifiedItemDto, UpsertAssetDto, PublishProductDto } from './dto/unified-item.dto';
import * as crypto from 'crypto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly osposService: OsposIntegrationService,
  ) {}

  /**
   * Maps a raw OSPOS item and local db product metadata into a UnifiedItemDto.
   */
  private buildUnifiedItem(
    osposItem: OsposItem,
    dbProduct: any | null,
    isStaleData = false,
  ): UnifiedItemDto {
    const dto = new UnifiedItemDto();
    dto.itemId = osposItem.item_id;
    dto.name = osposItem.name;
    dto.category = osposItem.category ?? '';
    dto.categoryId = osposItem.category_id ?? null;
    dto.subcategoryId = osposItem.subcategory_id ?? null;
    dto.sku = osposItem.sku ?? '';
    dto.description = osposItem.description ?? null;
    dto.price = osposItem.price;
    dto.quantity = osposItem.quantity;
    dto.isStaleData = isStaleData;
    dto.brand = osposItem.brand ?? null;
    dto.color = osposItem.color ?? null;

    // 1. Map OSPOS Attributes (Brand, Color, Material, Size)
    dto.brand = osposItem.attributes?.['Brand'] || osposItem.attributes?.['brand'] || null;
    dto.color = osposItem.attributes?.['Color'] || osposItem.attributes?.['color'] || null;
    const osposSize = osposItem.attributes?.['Size'] || osposItem.attributes?.['size'] || null;
    dto.size = osposSize;
    dto.dimensions = null;

    if (dbProduct && dbProduct.product_assets) {
      const asset = dbProduct.product_assets;
      dto.imageUrl = asset.image_url ?? null;
      dto.glbUrl = asset.glb_url ?? null;
      
      const transform = asset.asset_transformations;
      dto.scale = {
        x: transform?.scale_x ? Number(transform.scale_x) : 1,
        y: transform?.scale_y ? Number(transform.scale_y) : 1,
        z: transform?.scale_z ? Number(transform.scale_z) : 1,
      };
      dto.rotationY = transform?.rotation_y ? Number(transform.rotation_y) : 0;
      dto.tags = asset.product_asset_tags
        ? asset.product_asset_tags.map((pat: any) => pat.tags?.tag_name).filter(Boolean)
        : [];
      dto.material = osposItem.attributes?.['Material'] || osposItem.attributes?.['material'] || osposItem.material || asset.material_type || null;
      dto.finish = osposItem.attributes?.['Color'] || osposItem.attributes?.['color'] || osposItem.color || asset.color_family || null;
      
      if (asset.asset_sizes) {
        dto.dimensions = {
          width: Number(asset.asset_sizes.width || 0),
          height: Number(asset.asset_sizes.height || 0),
          depth: Number(asset.asset_sizes.depth || 0),
          unit: asset.asset_sizes.unit || 'cm',
        };
        if (!dto.size && dto.dimensions.width && dto.dimensions.height) {
          dto.size = `${dto.dimensions.width}x${dto.dimensions.height} ${dto.dimensions.unit}`;
        }
      }

      dto.isEnabled = dbProduct.is_active ?? true;
      dto.notes = null;
      dto.hasAssetEntry = true;
    } else {
      dto.imageUrl = null;
      dto.glbUrl = null;
      dto.scale = { x: 1, y: 1, z: 1 };
      dto.rotationY = 0;
      dto.tags = [];
      dto.material = osposItem.attributes?.['Material'] || osposItem.attributes?.['material'] || osposItem.material || null;
      dto.finish = osposItem.attributes?.['Color'] || osposItem.attributes?.['color'] || osposItem.color || null;
      dto.isEnabled = false;
      dto.notes = null;
      dto.hasAssetEntry = false;
    }

    // Auto-parse size string into dimensions if asset_sizes wasn't explicitly set
    if (!dto.dimensions && dto.size) {
      const match = dto.size.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        let w = parseFloat(match[1]);
        let h = parseFloat(match[2]);
        const unit = dto.size.toLowerCase().includes('m') && !dto.size.toLowerCase().includes('cm') && !dto.size.toLowerCase().includes('mm') ? 'm' : 'cm';
        if (dto.size.toLowerCase().includes('mm')) {
          w = w / 10;
          h = h / 10;
        }
        dto.dimensions = { width: w, height: h, depth: 1, unit };
      }
    }

    return dto;
  }

  /**
   * Returns all active OSPOS items merged with their visual asset entries.
   * If includeHidden is false, it only returns items that have an asset entry and are enabled/visible.
   */
  async findAll(includeHidden: boolean = false, filters: any = {}): Promise<UnifiedItemDto[]> {
    const [osposItems, dbProducts] = await Promise.all([
      this.osposService.fetchAllItems(),
      this.prisma.products.findMany({
        include: {
          product_assets: {
            include: {
              asset_sizes: true,
              asset_transformations: true,
              product_asset_tags: {
                include: {
                  tags: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const productMap = new Map(dbProducts.map((p) => [p.ospos_item_id, p]));

    let result: UnifiedItemDto[] = [];

    if (osposItems.length === 0 && dbProducts.length > 0) {
      this.logger.warn('OSPOS connection failed or returned no items. Returning local database product records with fallback stock status.');
      result = dbProducts.map((dbProduct) => {
        const fallbackOsposItem: OsposItem = {
          item_id: dbProduct.ospos_item_id,
          name: `Product ${dbProduct.ospos_item_id}`,
          category: 'Unknown',
          category_id: null,
          subcategory_id: null,
          sku: '',
          description: 'Live catalog details temporarily unavailable.',
          price: 0,
          quantity: 0,
        };
        return this.buildUnifiedItem(fallbackOsposItem, dbProduct, true);
      });
    } else {
      result = osposItems.map((item) =>
        this.buildUnifiedItem(item, productMap.get(item.item_id) ?? null, false),
      );
    }

    // ── Step 2: Collect stale local DB items that are missing from OSPOS ──────
    // This ensures admin can still see/manage local products not yet in OSPOS.
    if (osposItems.length > 0) {
      const osposItemIds = new Set(osposItems.map((item) => item.item_id));
      for (const dbProduct of dbProducts) {
        if (!osposItemIds.has(dbProduct.ospos_item_id)) {
          // Smart fallback: infer name and category from image URL if available
          let fallbackName = `Product ${dbProduct.ospos_item_id}`;
          let fallbackCategory = 'Unknown';

          if (dbProduct.product_assets?.image_url) {
            const imgUrl = dbProduct.product_assets.image_url.toLowerCase();
            if (imgUrl.includes('tile')) fallbackCategory = 'Tiles';
            else if (imgUrl.includes('basin') || imgUrl.includes('sink')) fallbackCategory = 'Wash Basins';
            else if (imgUrl.includes('closet') || imgUrl.includes('toilet')) fallbackCategory = 'Water Closets';

            // Try to extract a nice name from the filename
            const filename = imgUrl.split('/').pop() || '';
            const namePart = filename.split('.')[0];
            if (namePart) {
              fallbackName = namePart.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            }
          }

          const fallbackOsposItem: OsposItem = {
            item_id: dbProduct.ospos_item_id,
            name: fallbackName,
            category: fallbackCategory,
            category_id: null,
            subcategory_id: null,
            sku: `LOCAL-${dbProduct.ospos_item_id}`,
            description: 'Local product record (missing from OSPOS).',
            price: 0,
            quantity: 0,
          };
          result.push(this.buildUnifiedItem(fallbackOsposItem, dbProduct, true));
        }
      }
    }

    if (!includeHidden) {
      result = result.filter((item) => item.hasAssetEntry && item.isEnabled);
    }

    // Apply Dynamic Filters
    const {
      categoryId,
      subcategoryId,
      search,
      brand,
      material,
      finish,
      size,
      minPrice,
      maxPrice,
    } = filters;

    if (categoryId !== undefined) {
      result = result.filter((item) => item.categoryId === categoryId);
    }

    if (subcategoryId !== undefined) {
      result = result.filter((item) => item.subcategoryId === subcategoryId);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((item) => {
        const nameMatches = item.name.toLowerCase().includes(searchLower);
        const skuMatches = item.sku.toLowerCase().includes(searchLower);
        return nameMatches || skuMatches;
      });
    }

    if (brand) {
      const brandsLower = brand.toLowerCase().split(',');
      result = result.filter((item) => item.brand && brandsLower.includes(item.brand.toLowerCase()));
    }

    if (material) {
      const materialsLower = material.toLowerCase().split(',');
      result = result.filter((item) => item.material && materialsLower.includes(item.material.toLowerCase()));
    }

    if (finish) {
      const finishesLower = finish.toLowerCase().split(',');
      result = result.filter((item) => item.finish && finishesLower.includes(item.finish.toLowerCase()));
    }

    if (size) {
      const sizesLower = size.toLowerCase().split(',');
      result = result.filter((item) => item.tags.some(tag => sizesLower.includes(tag.toLowerCase())));
    }

    if (minPrice !== undefined) {
      result = result.filter((item) => item.price >= minPrice);
    }

    if (maxPrice !== undefined) {
      result = result.filter((item) => item.price <= maxPrice);
    }

    return result;
  }

  /**
   * Returns all OSPOS items that do not have a corresponding record in the local products table.
   * These items are pending review and can be imported into the Tile Vista catalog.
   */
  async getPendingReviewItems(): Promise<OsposItem[]> {
    const [osposItems, dbProducts] = await Promise.all([
      this.osposService.fetchAllItems(),
      this.prisma.products.findMany({
        select: { ospos_item_id: true },
      }),
    ]);

    const existingIds = new Set(dbProducts.map((p) => p.ospos_item_id));
    return osposItems.filter((item) => !existingIds.has(item.item_id));
  }

  /**
   * Returns a single product merged with live stock and visual asset entries.
   * If includeHidden is false, throws a 404 if the item lacks an asset entry or is not visible.
   */
  async findOne(osposItemId: number, includeHidden: boolean = false): Promise<UnifiedItemDto> {
    const [osposItems, dbProduct] = await Promise.all([
      this.osposService.fetchAllItems(),
      this.prisma.products.findUnique({
        where: { ospos_item_id: osposItemId },
        include: {
          product_assets: {
            include: {
              asset_sizes: true,
              asset_transformations: true,
              product_asset_tags: {
                include: {
                  tags: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const osposItem = osposItems.find((i) => i.item_id === osposItemId);
    if (!osposItem) {
      // If OSPOS returned NO items at all, assume it's down and return a fallback
      if (dbProduct && osposItems.length === 0) {
        this.logger.warn(`OSPOS connection failed. Returning local database metadata for product ID ${osposItemId} with fallback stock status.`);
        const fallbackOsposItem: OsposItem = {
          item_id: dbProduct.ospos_item_id,
          name: `Product ${dbProduct.ospos_item_id}`,
          category: 'Unknown',
          category_id: null,
          subcategory_id: null,
          sku: '',
          description: 'Live details temporarily unavailable.',
          price: 0,
          quantity: 0,
        };
        const fallbackUnified = this.buildUnifiedItem(fallbackOsposItem, dbProduct, true);
        if (!includeHidden && (!fallbackUnified.hasAssetEntry || !fallbackUnified.isEnabled)) {
          throw new NotFoundException(`Product with ID ${osposItemId} not found.`);
        }
        return fallbackUnified;
      }
      
      // If OSPOS is online (length > 0) but the item wasn't found, it means it was deleted in OSPOS.
      throw new NotFoundException(`Product with ID ${osposItemId} not found.`);
    }

    const unified = this.buildUnifiedItem(osposItem, dbProduct, false);
    if (!includeHidden && (!unified.hasAssetEntry || !unified.isEnabled)) {
      throw new NotFoundException(`Product with ID ${osposItemId} not found.`);
    }
    return unified;
  }

  /**
   * Fetches the category hierarchy from OSPOS.
   */
  async getCategories(): Promise<any[]> {
    const categories = await this.osposService.fetchCategories();
    if (categories && categories.length > 0) {
      return categories;
    }
    this.logger.warn('OSPOS categories unavailable. Returning fallback category structure.');
    return [
      { id: 1, name: 'Tiles', subcategories: [
          { id: 1, name: 'Floor Tiles' }, { id: 2, name: 'Wall Tiles' }, 
          { id: 3, name: 'Outdoor Tiles' }, { id: 4, name: 'Mosaics' }
        ] 
      },
      { id: 2, name: 'Wash Basins', subcategories: [
          { id: 5, name: 'Vessel' }, { id: 6, name: 'Wall Hung' }, { id: 7, name: 'Floor Standing' }
        ] 
      },
      { id: 3, name: 'Water Closets', subcategories: [
          { id: 8, name: 'Floor Mounted' }, { id: 9, name: 'Wall Hung' }, { id: 10, name: 'Smart WC' }
        ] 
      },
      { id: 4, name: 'Accessories', subcategories: [
          { id: 11, name: 'Faucets' }, { id: 12, name: 'Bath & Shower' },
          { id: 13, name: 'Kitchen Sinks' }, { id: 14, name: 'Mirrors' }
        ] 
      },
    ];
  }

  /**
   * GET available filters (brands, materials, finishes, sizes) dynamically
   */
  async getAvailableFilters(categoryId?: number) {
    const filters: any = categoryId !== undefined ? { categoryId } : {};
    // Fetch all active items, merging OSPOS + TileVista local data
    const items = await this.findAll(false, filters);

    const brands = new Set<string>();
    const materials = new Set<string>();
    const finishes = new Set<string>();
    const sizes = new Set<string>();

    items.forEach((item) => {
      if (item.brand) brands.add(item.brand);
      if (item.material) materials.add(item.material);
      if (item.finish) finishes.add(item.finish);
      
      // Category-specific rule: Only expose size filter choices for Tiles (e.g. 60x60 cm)
      const isTileCategory = item.category.toLowerCase().includes('tile') || item.categoryId === 1;
      if (isTileCategory && item.size) {
        sizes.add(item.size);
      }
    });

    return {
      brands: Array.from(brands).sort(),
      materials: Array.from(materials).sort(),
      finishes: Array.from(finishes).sort(),
      sizes: Array.from(sizes).sort(),
    };
  }

  // ─── INTERNAL HELPERS ────────────────────────────────────────────────────────
  /**
   * Safe method used by core modules to fetch product metadata and live stock.
   */
  async findOneProductWithLiveStock(productId: number): Promise<UnifiedItemDto> {
    return this.findOne(productId);
  }

  /**
   * Creates or updates the visual assets catalog metadata for an OSPOS item.
   */
  async upsertAsset(
    osposItemId: number,
    dto: UpsertAssetDto,
  ): Promise<UnifiedItemDto> {
    let product = await this.prisma.products.findUnique({
      where: { ospos_item_id: osposItemId },
      include: { product_assets: true }
    });

    if (!product) {
      const productId = crypto.randomUUID();
      const assetId = crypto.randomUUID();
      const transformId = crypto.randomUUID();

      product = await this.prisma.products.create({
        data: {
          product_id: productId,
          ospos_item_id: osposItemId,
          is_active: dto.isEnabled ?? true,
          product_assets: {
            create: {
              asset_id: assetId,
              material_type: dto.material ?? null,
              color_family: dto.finish ?? null,
              is_visible: dto.isEnabled ?? true,
              asset_transformations: {
                create: {
                  transform_id: transformId,
                  scale_x: dto.scaleX ?? 1.0,
                  scale_y: dto.scaleY ?? 1.0,
                  scale_z: dto.scaleZ ?? 1.0,
                  rotation_y: dto.rotationY ?? 0.0,
                }
              }
            }
          }
        },
        include: { product_assets: true }
      });
    } else {
      await this.prisma.products.update({
        where: { ospos_item_id: osposItemId },
        data: {
          is_active: dto.isEnabled ?? undefined,
          product_assets: {
            update: {
              material_type: dto.material ?? undefined,
              color_family: dto.finish ?? undefined,
              is_visible: dto.isEnabled ?? undefined,
              asset_transformations: {
                update: {
                  scale_x: dto.scaleX ?? undefined,
                  scale_y: dto.scaleY ?? undefined,
                  scale_z: dto.scaleZ ?? undefined,
                  rotation_y: dto.rotationY ?? undefined,
                }
              }
            }
          }
        }
      });
    }

    // Process asset_sizes if dimensions are specified
    if ((dto.width !== undefined || dto.height !== undefined || dto.depth !== undefined || dto.unit !== undefined) && product.product_assets) {
      const assetId = product.product_assets.asset_id;
      const existingSize = await this.prisma.asset_sizes.findUnique({
        where: { asset_id: assetId }
      });

      if (existingSize) {
        await this.prisma.asset_sizes.update({
          where: { asset_id: assetId },
          data: {
            width: dto.width !== undefined ? dto.width : undefined,
            height: dto.height !== undefined ? dto.height : undefined,
            depth: dto.depth !== undefined ? dto.depth : undefined,
            unit: dto.unit ? (dto.unit === 'm' ? 'm' : 'cm') : undefined,
          }
        });
      } else {
        await this.prisma.asset_sizes.create({
          data: {
            size_id: crypto.randomUUID(),
            asset_id: assetId,
            width: dto.width ?? 0,
            height: dto.height ?? 0,
            depth: dto.depth ?? 0,
            unit: dto.unit === 'm' ? 'm' : 'cm',
          }
        });
      }
    }

    // Process tags relations if specified
    if (dto.tags !== undefined && product.product_assets) {
      const assetId = product.product_assets.asset_id;
      
      // Delete existing relationships
      await this.prisma.product_asset_tags.deleteMany({
        where: { asset_id: assetId }
      });

      const tagNames = dto.tags ? dto.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      for (const name of tagNames) {
        let tag = await this.prisma.tags.findUnique({ where: { tag_name: name } });
        if (!tag) {
          tag = await this.prisma.tags.create({
            data: {
              tag_id: crypto.randomUUID(),
              tag_name: name,
            }
          });
        }
        await this.prisma.product_asset_tags.create({
          data: {
            asset_id: assetId,
            tag_id: tag.tag_id,
          }
        });
      }
    }

    return this.findOne(osposItemId, true);
  }

  async publishProduct(data: PublishProductDto) {
    // 1. Verify osposItemId exists in live OSPOS
    const allOsposItems = await this.osposService.fetchAllItems();
    const osposItem = allOsposItems.find(i => i.item_id === data.osposItemId);
    if (!osposItem) {
      throw new NotFoundException(`OSPOS item with ID ${data.osposItemId} not found.`);
    }

    // 2. Verify no products row already exists
    const existing = await this.prisma.products.findUnique({
      where: { ospos_item_id: data.osposItemId }
    });
    if (existing) {
      throw new ConflictException(`Product with OSPOS item ID ${data.osposItemId} already exists. Please edit it instead.`);
    }

    // 3. Create all in transaction
    return this.prisma.$transaction(async (tx) => {
      const productId = crypto.randomUUID();
      const assetId = crypto.randomUUID();

      const product = await tx.products.create({
        data: {
          product_id: productId,
          ospos_item_id: data.osposItemId,
          is_active: true,
        }
      });

      const productAsset = await tx.product_assets.create({
        data: {
          asset_id: assetId,
          product_id: productId,
          image_url: data.imageUrl,
          thumbnail_url: data.thumbnailUrl,
          glb_url: data.glbUrl,
          material_type: data.materialType,
          color_family: data.colorFamily,
          is_visible: true,
        }
      });

      await tx.asset_sizes.create({
        data: {
          size_id: crypto.randomUUID(),
          asset_id: assetId,
          width: data.width,
          height: data.height,
          depth: data.depth,
          unit: data.unit === 'm' ? 'm' : 'cm',
        }
      });

      await tx.asset_transformations.create({
        data: {
          transform_id: crypto.randomUUID(),
          asset_id: assetId,
          scale_x: 1.0,
          scale_y: 1.0,
          scale_z: 1.0,
          rotation_x: 0,
          rotation_y: 0,
          rotation_z: 0,
        }
      });

      return { product, productAsset };
    });
  }

  /**
   * Sets product visual asset image URL.
   */
  async setImageUrl(osposItemId: number, imageUrl: string): Promise<void> {
    let product = await this.prisma.products.findUnique({
      where: { ospos_item_id: osposItemId },
      include: { product_assets: true }
    });

    if (!product) {
      await this.upsertAsset(osposItemId, { isEnabled: true });
      product = await this.prisma.products.findUnique({
        where: { ospos_item_id: osposItemId },
        include: { product_assets: true }
      });
    }

    if (product && product.product_assets) {
      await this.prisma.product_assets.update({
        where: { asset_id: product.product_assets.asset_id },
        data: { image_url: imageUrl }
      });
    }
  }

  /**
   * Sets product visual asset 3D GLB URL.
   */
  async setGlbUrl(osposItemId: number, glbUrl: string): Promise<void> {
    let product = await this.prisma.products.findUnique({
      where: { ospos_item_id: osposItemId },
      include: { product_assets: true }
    });

    if (!product) {
      await this.upsertAsset(osposItemId, { isEnabled: true });
      product = await this.prisma.products.findUnique({
        where: { ospos_item_id: osposItemId },
        include: { product_assets: true }
      });
    }

    if (product && product.product_assets) {
      await this.prisma.product_assets.update({
        where: { asset_id: product.product_assets.asset_id },
        data: { glb_url: glbUrl }
      });
    }
  }
}
