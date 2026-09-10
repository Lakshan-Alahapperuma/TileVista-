import { Injectable, NotFoundException } from '@nestjs/common';
import { PackageRepository } from './package.repository';
import { OsposIntegrationService, OsposItem } from '../integrations/ospos/ospos.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackageService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly osposService: OsposIntegrationService,
  ) {}

  async findAll(includeInactive = false) {
    const pkgs = await this.packageRepository.findAll(includeInactive);
    const osposItems = await this.osposService.fetchAllItems();
    const osposMap = new Map<number, OsposItem>(
      osposItems.map((item) => [item.item_id, item]),
    );

    return pkgs.map((pkg) => this.enrichPackage(pkg, osposMap));
  }

  async findOne(id: string) {
    const pkg = await this.packageRepository.findById(id);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    const osposItems = await this.osposService.fetchAllItems();
    const osposMap = new Map<number, OsposItem>(
      osposItems.map((item) => [item.item_id, item]),
    );

    return this.enrichPackage(pkg, osposMap);
  }

  async create(data: CreatePackageDto) {
    return this.packageRepository.create(data);
  }

  async update(id: string, data: UpdatePackageDto) {
    return this.packageRepository.update(id, data);
  }

  async remove(id: string) {
    return this.packageRepository.delete(id);
  }

  private enrichPackage(pkg: any, osposMap: Map<number, OsposItem>) {
    let originalPrice = 0;
    const enrichedItems = (pkg.package_items || []).map((pi: any) => {
      const product = pi.products;
      const osposItemId = product?.ospos_item_id;
      const osposItem = osposMap.get(osposItemId) || null;

      const itemPrice = osposItem?.price || 0;
      const qty = pi.quantity || 1;
      originalPrice += itemPrice * qty;

      return {
        productId: product?.product_id || '',
        osposItemId,
        quantity: qty,
        name: osposItem?.name || product?.product_assets?.name || 'Unknown Item',
        price: itemPrice,
        category: osposItem?.category || 'General',
        sku: osposItem?.sku || '',
        glbUrl: product?.product_assets?.glb_url || null,
        imageUrl: product?.product_assets?.image_url || null,
      };
    });

    const discountPercent = Number(pkg.discount_percentage || 0);
    const calculatedPrice = originalPrice * (1 - discountPercent / 100);

    return {
      id: pkg.package_id,
      name: pkg.package_name,
      description: pkg.description,
      imageUrl: pkg.cover_image,
      discountPercent,
      calculatedPrice: Number(calculatedPrice.toFixed(2)),
      originalPrice: Number(originalPrice.toFixed(2)),
      items: enrichedItems,
      status: pkg.status,
      createdAt: pkg.created_at,
    };
  }
}
